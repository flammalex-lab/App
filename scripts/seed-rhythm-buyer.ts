/**
 * Seed a dummy B2B buyer with enough Friday-delivered order history
 * to make /guide's rhythm-driven draft (PR #107) render meaningfully.
 *
 * Creates:
 *   - Account "Rhythm Demo Kitchen" (active, Friday delivery, $300 min)
 *   - Buyer profile rhythm-demo@ilovenyfarms.com / password: rhythmdemo
 *   - 4 past-Friday orders (status=delivered), each with 8 line items
 *     drawn from real products in the catalog
 *
 * After running, sign in at /login with the credentials above. /guide
 * should open as "Your draft for Friday, <next-friday>" with qtys
 * pre-filled from the average across those 4 historical orders.
 *
 * Re-running is safe: upserts by email / account name, and recreates
 * the orders so the rolling 4-week window stays current.
 *
 * Cleanup (manual SQL):
 *   delete from order_items where order_id in (select id from orders where order_number like 'FLF-DEMO-%');
 *   delete from orders where order_number like 'FLF-DEMO-%';
 *   delete from profiles where email = 'rhythm-demo@ilovenyfarms.com';
 *   delete from accounts where name = 'Rhythm Demo Kitchen';
 *
 * Run:
 *   npx tsx scripts/seed-rhythm-buyer.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.local manually (mirrors seed-demo.ts — no dotenv dep needed).
try {
  const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const sb = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BUYER_EMAIL = "rhythm-demo@ilovenyfarms.com";
const BUYER_PASSWORD = "rhythmdemo";
const ACCOUNT_NAME = "Rhythm Demo Kitchen";

// Last 4 Fridays in the strict past so the buyer's draft for THIS
// Friday is purely rhythm-derived (not contaminated by today's order).
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

async function main() {
  console.log("→ Seeding rhythm-demo buyer + history…");

  // ── 1. Ensure auth user
  console.log("  · ensuring auth user");
  const { data: existing } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  let userId = existing?.users.find((u) => u.email === BUYER_EMAIL)?.id ?? null;
  if (!userId) {
    const { data: created, error } = await sb.auth.admin.createUser({
      email: BUYER_EMAIL,
      password: BUYER_PASSWORD,
      email_confirm: true,
    });
    if (error || !created.user) {
      console.error("    createUser failed:", error?.message);
      process.exit(1);
    }
    userId = created.user.id;
    console.log("    ✓ created auth user");
  } else {
    await sb.auth.admin.updateUserById(userId, { password: BUYER_PASSWORD });
    console.log("    ✓ updated existing auth user");
  }

  // ── 2. Account
  console.log("  · upserting account");
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
    if (error || !acct) {
      console.error("    accounts insert failed:", error?.message);
      process.exit(1);
    }
    accountId = (acct as { id: string }).id;
    console.log("    ✓ created account", accountId);
  } else {
    await sb.from("accounts").update(accountRow).eq("id", accountId);
    console.log("    ✓ updated account", accountId);
  }

  // ── 3. Profile
  console.log("  · upserting profile");
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
  console.log("    ✓ profile linked to account");

  // ── 4. Pick real products from the catalog
  console.log("  · picking products from catalog");
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
    console.error("    not enough active b2b products to seed (need ≥8):", prodErr?.message);
    process.exit(1);
  }
  type P = {
    id: string;
    name: string;
    sku: string | null;
    wholesale_price: number;
    unit: string;
    pack_size: string | null;
  };
  // Stable 8 products → re-runs produce the same draft. Slice (not random)
  // so the rhythm averages are deterministic across re-runs.
  const picked = (prodRows as P[]).slice(0, 8);
  console.log("    ✓ picked", picked.length, "products");

  // ── 5. Generate 4 past-Friday orders
  const fridays = lastNFridays(4);
  console.log("  · seeding 4 Friday orders:", fridays.map(isoDate));

  // Wipe prior FLF-DEMO orders for this account so the rolling window
  // stays current across re-runs.
  const { data: prior } = await sb
    .from("orders")
    .select("id")
    .like("order_number", "FLF-DEMO-%")
    .eq("account_id", accountId);
  const priorIds = ((prior as { id: string }[] | null) ?? []).map((p) => p.id);
  if (priorIds.length > 0) {
    await sb.from("order_items").delete().in("order_id", priorIds);
    await sb.from("orders").delete().in("id", priorIds);
    console.log("    ✓ wiped", priorIds.length, "prior demo orders");
  }

  // Slight qty variance across the 4 weeks so the rolling average isn't
  // a flat integer for every row. Buyer-rhythm should still read as
  // stable when the meta says "Usually 3" (avg of [3,3,4,3] → 3.25 → 3).
  const variance = [0, +1, -1, 0];
  for (let i = 0; i < fridays.length; i++) {
    const friday = fridays[i];
    const isoFri = isoDate(friday);
    const placedAt = new Date(friday);
    placedAt.setDate(placedAt.getDate() - 3); // Tuesday placement

    const linesThisOrder = picked.slice(0, 8).map((p) => {
      const lc = p.name.toLowerCase();
      const baseQty = lc.includes("egg") ? 3
        : lc.includes("milk") ? 2
        : lc.includes("yogurt") ? 2
        : 1;
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
      console.error(`    ${orderNumber} insert failed:`, orderErr?.message);
      continue;
    }
    const orderId = (orderRow as { id: string }).id;
    const { error: itemsErr } = await sb
      .from("order_items")
      .insert(linesThisOrder.map((l) => ({ ...l, order_id: orderId })));
    if (itemsErr) {
      console.error(`    ${orderNumber} order_items insert failed:`, itemsErr.message);
      continue;
    }
    console.log(`    ✓ ${orderNumber} · deliver ${isoFri} · ${linesThisOrder.length} lines · $${total}`);
  }

  console.log("\n✅ Done. Sign in:");
  console.log(`   email:    ${BUYER_EMAIL}`);
  console.log(`   password: ${BUYER_PASSWORD}`);
  console.log("   Then /guide should open as a populated draft for the next Friday.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
