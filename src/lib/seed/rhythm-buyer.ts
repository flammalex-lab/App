import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Seed a dummy B2B buyer with enough Friday-delivered order history
 * to make /guide's rhythm-driven draft (PR #107) render meaningfully.
 *
 * Idempotent on the buyer/account/profile (upserts by email + name);
 * non-idempotent on orders by design — every call wipes prior
 * `FLF-DEMO-%` orders for this account and reseeds so the rolling
 * 4-Friday window stays current as time passes.
 *
 * Used from both:
 *   - scripts/seed-rhythm-buyer.ts  (CLI on a dev machine)
 *   - /api/admin/seed-rhythm-buyer  (admin-gated, runs against live DB)
 */
export const BUYER_EMAIL = "rhythm-demo@ilovenyfarms.com";
export const BUYER_PASSWORD = "rhythmdemo";
export const ACCOUNT_NAME = "Rhythm Demo Kitchen";

export interface SeedResult {
  userId: string;
  accountId: string;
  ordersSeeded: Array<{ orderNumber: string; deliveryDate: string; total: number; lines: number }>;
  ordersWiped: number;
  productsPicked: number;
}

/** Last N Fridays strictly in the past so the draft for *this* Friday
 *  is purely rhythm-derived (not contaminated by today's order). */
function lastNFridays(n: number): Date[] {
  const out: Date[] = [];
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const cursor = new Date(today);
  const dow = cursor.getDay(); // 0=sun..6=sat
  const daysSinceFri = (dow + 7 - 5) % 7;
  cursor.setDate(cursor.getDate() - (daysSinceFri === 0 ? 7 : daysSinceFri));
  for (let i = 0; i < n; i++) {
    out.push(new Date(cursor));
    cursor.setDate(cursor.getDate() - 7);
  }
  return out;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type ProductPick = {
  id: string;
  name: string;
  sku: string | null;
  wholesale_price: number;
  unit: string;
  pack_size: string | null;
};

export async function seedRhythmBuyer(sb: SupabaseClient): Promise<SeedResult> {
  // ── 1. Ensure auth user
  const { data: existing } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  let userId = existing?.users.find((u) => u.email === BUYER_EMAIL)?.id ?? null;
  if (!userId) {
    const { data: created, error } = await sb.auth.admin.createUser({
      email: BUYER_EMAIL,
      password: BUYER_PASSWORD,
      email_confirm: true,
    });
    if (error || !created.user) {
      throw new Error(`createUser failed: ${error?.message ?? "unknown"}`);
    }
    userId = created.user.id;
  } else {
    await sb.auth.admin.updateUserById(userId, { password: BUYER_PASSWORD });
  }

  // ── 2. Account
  const accountRow = {
    name: ACCOUNT_NAME,
    type: "restaurant",
    channel: "b2b",
    status: "active",
    pricing_tier: "standard",
    enabled_categories: ["dairy", "eggs", "produce", "beef", "pork"],
    primary_contact_name: "Rhythm Demo",
    primary_contact_email: BUYER_EMAIL,
    delivery_zone: "zone_3",
    delivery_day: "friday",
    order_minimum: 300,
    city: "Ithaca",
    state: "NY",
  } as Record<string, unknown>;
  const { data: existingAccount } = await sb
    .from("accounts")
    .select("id")
    .eq("name", ACCOUNT_NAME)
    .maybeSingle();
  let accountId = (existingAccount as { id: string } | null)?.id ?? null;
  if (!accountId) {
    const { data: acct, error } = await sb
      .from("accounts")
      .insert(accountRow)
      .select("id")
      .single();
    if (error || !acct) throw new Error(`accounts insert failed: ${error?.message ?? "unknown"}`);
    accountId = (acct as { id: string }).id;
  } else {
    await sb.from("accounts").update(accountRow).eq("id", accountId);
  }

  // ── 3. Profile
  await sb.from("profiles").upsert(
    {
      id: userId,
      email: BUYER_EMAIL,
      first_name: "Rhythm",
      last_name: "Demo",
      role: "b2b_buyer",
      account_id: accountId,
    },
    { onConflict: "id" },
  );

  // ── 4. Pick real products from the catalog
  const { data: prodRows, error: prodErr } = await sb
    .from("products")
    .select("id, name, sku, wholesale_price, unit, pack_size, available_b2b, is_active")
    .eq("is_active", true)
    .eq("available_b2b", true)
    .not("wholesale_price", "is", null)
    .gt("wholesale_price", 0)
    .order("name")
    .limit(40);
  if (prodErr || !prodRows || prodRows.length < 8) {
    throw new Error(
      `not enough active b2b products to seed (need ≥8): ${prodErr?.message ?? "found " + (prodRows?.length ?? 0)}`,
    );
  }
  // Stable 8-product slice (not random) — re-runs produce the same draft.
  const picked = (prodRows as ProductPick[]).slice(0, 8);

  // ── 5. Wipe prior FLF-DEMO orders for this account, then seed 4 Fridays
  const { data: prior } = await sb
    .from("orders")
    .select("id")
    .like("order_number", "FLF-DEMO-%")
    .eq("account_id", accountId);
  const priorIds = ((prior as { id: string }[] | null) ?? []).map((p) => p.id);
  if (priorIds.length > 0) {
    await sb.from("order_items").delete().in("order_id", priorIds);
    await sb.from("orders").delete().in("id", priorIds);
  }

  const fridays = lastNFridays(4);
  // Slight qty variance across weeks so the rolling average isn't a flat
  // integer per row. Still stable enough to read as "Usually 3".
  const variance = [0, +1, -1, 0];
  const ordersSeeded: SeedResult["ordersSeeded"] = [];
  for (let i = 0; i < fridays.length; i++) {
    const friday = fridays[i];
    const isoFri = isoDate(friday);
    const placedAt = new Date(friday);
    placedAt.setDate(placedAt.getDate() - 3); // Tuesday placement

    const linesThisOrder = picked.slice(0, 8).map((p) => {
      const lc = p.name.toLowerCase();
      const baseQty = lc.includes("egg") ? 3 : lc.includes("milk") ? 2 : lc.includes("yogurt") ? 2 : 1;
      const qty = Math.max(1, baseQty + (variance[i] ?? 0) * (Math.random() > 0.6 ? 1 : 0));
      const unitPrice = Number(p.wholesale_price);
      return {
        product_id: p.id,
        quantity: qty,
        unit_price: unitPrice,
        line_total: Number((unitPrice * qty).toFixed(2)),
      };
    });

    const subtotal = linesThisOrder.reduce((s, l) => s + l.line_total, 0);
    const total = Number(subtotal.toFixed(2));
    const orderNumber = `FLF-DEMO-${String(i + 1).padStart(3, "0")}`;

    const { data: orderRow, error: orderErr } = await sb
      .from("orders")
      .insert({
        order_number: orderNumber,
        order_type: "b2b",
        status: "delivered",
        profile_id: userId,
        account_id: accountId,
        requested_delivery_date: isoFri,
        subtotal,
        total,
        delivery_fee: 0,
        tax: 0,
        payment_method: "invoice",
        payment_status: "paid",
        created_at: placedAt.toISOString(),
      })
      .select("id")
      .single();
    if (orderErr || !orderRow) {
      throw new Error(`${orderNumber} insert failed: ${orderErr?.message ?? "unknown"}`);
    }
    const orderId = (orderRow as { id: string }).id;
    const { error: itemsErr } = await sb
      .from("order_items")
      .insert(linesThisOrder.map((l) => ({ ...l, order_id: orderId })));
    if (itemsErr) {
      throw new Error(`${orderNumber} order_items insert failed: ${itemsErr.message}`);
    }
    ordersSeeded.push({
      orderNumber,
      deliveryDate: isoFri,
      total,
      lines: linesThisOrder.length,
    });
  }

  return {
    userId,
    accountId,
    ordersSeeded,
    ordersWiped: priorIds.length,
    productsPicked: picked.length,
  };
}
