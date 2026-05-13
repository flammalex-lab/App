import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import { loadPricingContext, priceForProduct } from "@/lib/utils/pricing";
import { nextDeliveryForZone } from "@/lib/utils/cutoff";
import { BUSINESS_TIMEZONE } from "@/lib/constants";
import {
  getAllowedPrivateProductIds,
  isProductVisibleToAccount,
} from "@/lib/products/queries";
import type {
  Account,
  DeliveryZoneRow,
  Order,
  OrderItem,
  Product,
  Profile,
} from "@/lib/supabase/types";

interface BodyLine {
  productId: string;
  quantity: number;
  notes?: string | null;
  variantKey?: string | null;
  variantSku?: string | null;
}

interface Body {
  lines: BodyLine[];
}

/**
 * Append-only amendment to a placed order. Buyer-side only — admins use
 * /admin tools to edit/cancel. Mirrors /api/orders/create's pricing +
 * visibility checks so amended lines can't drift from what the catalog
 * would charge. On success, posts an `order_amended` system message
 * into the account's chat thread so the rep sees what changed.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: orderId } = await params;
  if (!orderId) {
    return NextResponse.json({ error: "missing order id" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !Array.isArray(body.lines)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const rawLines = body.lines.filter(
    (l) =>
      l &&
      typeof l.productId === "string" &&
      Number.isFinite(Number(l.quantity)) &&
      Number(l.quantity) > 0,
  );
  if (rawLines.length === 0) {
    return NextResponse.json({ error: "nothing to add" }, { status: 400 });
  }

  // Auth model matches /api/orders/create: admin sessions may impersonate a
  // buyer via the signed cookie; everyone else acts as themselves. Service
  // client is used either way so RLS doesn't fight the amendment.
  const impersonating =
    session.profile.role === "admin" ? await getImpersonation() : null;
  const actingAsId = impersonating ?? session.userId;
  const svc = createServiceClient();

  const { data: orderRow } = await svc
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (!orderRow) {
    return NextResponse.json({ error: "order not found" }, { status: 404 });
  }
  const order = orderRow as Order;

  // Ownership gate. Buyer (or admin impersonating that buyer) must own
  // the order. Anything else → 403 — never leak existence to other
  // accounts via different status codes.
  if (order.profile_id !== actingAsId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Append-only on a *pending* order. Confirmed/processing/etc. are off-
  // limits — at that point the rep has already started prep and the
  // amendment has to be a human conversation, not a self-serve POST.
  if (order.status !== "pending") {
    return NextResponse.json(
      { error: "order is no longer amendable" },
      { status: 400 },
    );
  }

  // Cutoff gate. Look up the buyer's delivery zone + per-account day
  // overrides, then ask cutoff.ts for the next-delivery window. If the
  // order's delivery (or pickup) date no longer matches an upcoming
  // pre-cutoff slot, reject — the rep needs the heads-up before
  // touching prep.
  const { data: buyerRow } = await svc
    .from("profiles")
    .select("*")
    .eq("id", actingAsId)
    .maybeSingle();
  if (!buyerRow) {
    return NextResponse.json({ error: "profile not found" }, { status: 400 });
  }
  const buyer = buyerRow as Profile;

  let account: Account | null = null;
  if (buyer.account_id) {
    const { data: acctRow } = await svc
      .from("accounts")
      .select("*")
      .eq("id", buyer.account_id)
      .maybeSingle();
    account = (acctRow as Account | null) ?? null;
  }

  const deliveryIso = order.requested_delivery_date ?? order.pickup_date ?? null;
  if (deliveryIso) {
    let zone: DeliveryZoneRow | null = null;
    if (account?.delivery_zone) {
      const { data: z } = await svc
        .from("delivery_zones")
        .select("*")
        .eq("zone", account.delivery_zone)
        .maybeSingle();
      zone = (z as DeliveryZoneRow | null) ?? null;
    }
    if (zone) {
      const nextDel = nextDeliveryForZone(
        zone,
        new Date(),
        BUSINESS_TIMEZONE,
        account?.delivery_days,
      );
      // If the soonest live slot is past the order's date OR the
      // computed cutoff is already in the past, the window is closed.
      // We compare by ISO date string in the business tz to match how
      // the order row stores it ("YYYY-MM-DD").
      if (!nextDel) {
        return NextResponse.json(
          { error: "no upcoming delivery window" },
          { status: 400 },
        );
      }
      const nextDelIso = isoDateInTz(nextDel.deliveryDate, BUSINESS_TIMEZONE);
      // The order's date must still be the *current* next-delivery slot
      // (or later). If nextDel rolled past, the order's slot is gone.
      if (nextDelIso > deliveryIso) {
        return NextResponse.json(
          { error: "cutoff has passed for this order" },
          { status: 400 },
        );
      }
      if (nextDelIso === deliveryIso && nextDel.cutoffAt.getTime() <= Date.now()) {
        return NextResponse.json(
          { error: "cutoff has passed for this order" },
          { status: 400 },
        );
      }
    }
    // If no zone is configured (DTC pickup, etc.), skip cutoff math.
    // Status-pending is the gate in that path.
  }

  // Re-price + visibility-check every line server-side. Client-sent
  // unitPrice is ignored.
  const productIds = Array.from(new Set(rawLines.map((l) => l.productId)));
  const { data: productsData, error: productsErr } = await svc
    .from("products")
    .select("*")
    .in("id", productIds);
  if (productsErr) {
    return NextResponse.json({ error: productsErr.message }, { status: 500 });
  }
  const productsById = new Map(
    ((productsData as Product[] | null) ?? []).map((p) => [p.id, p]),
  );

  const isB2B = order.order_type === "b2b";
  const allowedPrivateIds = await getAllowedPrivateProductIds(
    svc,
    buyer.account_id ?? null,
  );
  const allowedPrivateSet = new Set(allowedPrivateIds);

  for (const line of rawLines) {
    const product = productsById.get(line.productId);
    if (!product) {
      return NextResponse.json(
        { error: `product ${line.productId} not found` },
        { status: 400 },
      );
    }
    if (!product.is_active) {
      return NextResponse.json(
        { error: `${product.name} is no longer active` },
        { status: 400 },
      );
    }
    if (isB2B && !product.available_b2b) {
      return NextResponse.json(
        { error: `${product.name} isn't available for B2B` },
        { status: 400 },
      );
    }
    if (!isB2B && !product.available_dtc) {
      return NextResponse.json(
        { error: `${product.name} isn't available for DTC` },
        { status: 400 },
      );
    }
    if (!product.available_this_week) {
      return NextResponse.json(
        { error: `${product.name} isn't available this week` },
        { status: 400 },
      );
    }
    if (product.private && !allowedPrivateSet.has(product.id)) {
      // Don't reveal that a private SKU exists — generic 400.
      return NextResponse.json(
        { error: `${product.name} isn't available for your account` },
        { status: 400 },
      );
    }
    // Belt-and-braces: same single-product visibility gate the PDP uses.
    // No-op for non-private products; cheap one-row check for private.
    const visible = await isProductVisibleToAccount(
      svc,
      { id: product.id, private: product.private },
      buyer.account_id ?? null,
    );
    if (!visible) {
      return NextResponse.json(
        { error: `${product.name} isn't available for your account` },
        { status: 400 },
      );
    }
  }

  const pricingCtx = await loadPricingContext(svc, account, isB2B);
  const pricedLines = rawLines.map((line) => {
    const product = productsById.get(line.productId)!;
    const unitPrice = priceForProduct(product, pricingCtx);
    return {
      ...line,
      product,
      quantity: Number(line.quantity),
      unitPrice,
    };
  });
  const unpriceable = pricedLines.find((l) => l.unitPrice == null);
  if (unpriceable) {
    return NextResponse.json(
      { error: `pricing not configured for ${unpriceable.product.name}` },
      { status: 400 },
    );
  }

  // Insert the new order_items rows.
  const newItemRows = pricedLines.map((l) => ({
    order_id: order.id,
    product_id: l.productId,
    quantity: l.quantity,
    unit_price: l.unitPrice as number,
    line_total: round2(l.quantity * (l.unitPrice as number)),
    notes: l.notes ?? null,
    pack_variant_key: l.variantKey ?? null,
    pack_variant_sku: l.variantSku ?? null,
  }));
  const { error: insertErr } = await svc.from("order_items").insert(newItemRows);
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Recompute order totals from the *full* item set after insert so
  // partial-update bugs can't drift the displayed total. delivery_fee
  // and tax carry over from the original placement.
  const { data: allItems } = await svc
    .from("order_items")
    .select("quantity, unit_price")
    .eq("order_id", order.id);
  const subtotal = round2(
    ((allItems as Pick<OrderItem, "quantity" | "unit_price">[] | null) ?? [])
      .reduce(
        (s, r) => s + Number(r.quantity) * Number(r.unit_price),
        0,
      ),
  );
  const total = round2(subtotal + Number(order.delivery_fee ?? 0) + Number(order.tax ?? 0));
  const { error: updErr } = await svc
    .from("orders")
    .update({ subtotal, total })
    .eq("id", order.id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // System message into the account's chat thread. ChatClient renders
  // unknown payload kinds via the dashed-fallback bubble + an
  // `View order` link, so this surfaces without a new chat-side renderer.
  if (buyer.account_id) {
    const addedCount = pricedLines.reduce((n, l) => n + l.quantity, 0);
    const firstLabel = pricedLines[0]?.product.name ?? "items";
    const distinct = pricedLines.length;
    const summaryItems =
      distinct === 1
        ? `${addedCount} × ${firstLabel}`
        : `${distinct} items (+${firstLabel}…)`;
    const buyerName = buyer.first_name?.trim() || "Buyer";
    const body = `${buyerName} added ${summaryItems} to ${order.order_number} — order now ${formatMoney(total)}.`;
    await svc.from("messages").insert({
      account_id: buyer.account_id,
      from_profile_id: null,
      to_profile_id: null,
      body,
      channel: "app",
      direction: "outbound",
      is_system: true,
      related_order_id: order.id,
      payload: {
        kind: "order_amended",
        order_id: order.id,
        order_number: order.order_number,
        added_items: addedCount,
        added_lines: distinct,
        subtotal,
        total,
        delivery_date: order.requested_delivery_date,
        pickup_date: order.pickup_date,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    addedCount: pricedLines.length,
    addedUnits: pricedLines.reduce((n, l) => n + l.quantity, 0),
    newTotal: total,
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

/**
 * Render a Date as YYYY-MM-DD in the given IANA timezone. Mirrors the
 * format orders.requested_delivery_date / pickup_date are stored in so
 * string comparison against `deliveryIso` is safe.
 */
function isoDateInTz(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
