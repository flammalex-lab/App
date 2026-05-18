import { NextResponse, after } from "next/server";
import { revalidateTag } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { getImpersonation } from "@/lib/auth/impersonation";
import { getStripe } from "@/lib/stripe/client";
import { loadPricingContext, priceForProduct } from "@/lib/utils/pricing";
import { meetsMinimum, effectiveOrderMinimum } from "@/lib/utils/order-minimum";
import type { OrderType, PaymentMethod, Profile, DeliveryZoneRow, Account } from "@/lib/supabase/types";
import type { TablesInsert } from "@/lib/supabase/database.types";
import { enqueueAndSend } from "@/lib/notifications/dispatch";
import { buyerHistoryTag } from "@/lib/products/buyer-history";
import { requireSameOrigin } from "@/lib/auth/same-origin";
import { getAllowedPrivateProductIds } from "@/lib/products/queries";
import { trackServer } from "@/lib/analytics/server";

interface BodyLine {
  productId: string;
  quantity: number;
  notes: string | null;
  variantKey?: string | null;
  variantSku?: string | null;
}

interface Body {
  orderType: OrderType;
  paymentMethod: PaymentMethod;
  requestedDeliveryDate: string | null;
  pickupDate: string | null;
  pickupLocationId: string | null;
  customerNotes: string | null;
  lines: BodyLine[];
}

export async function POST(request: Request) {
  const originGate = requireSameOrigin(request);
  if (originGate) return originGate;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  // Minimal shape validation. Anything past these checks gets caught by
  // resolvePrice/RLS/db-constraint paths and returns a sanitized error.
  // Goal: stop raw Postgres error strings (e.g. "invalid input syntax for
  // type uuid") from leaking to clients on malformed input.
  if (!body || typeof body !== "object" || !Array.isArray(body.lines)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const impersonating = session.profile.role === "admin" ? await getImpersonation() : null;
  const actingAsId = impersonating ?? session.userId;
  const placedById = impersonating ? session.userId : null;

  const svc = createServiceClient();
  const { data: buyer } = await svc.from("profiles").select("*").eq("id", actingAsId).maybeSingle();
  if (!buyer) return NextResponse.json({ error: "profile not found" }, { status: 400 });
  const effectiveProfile = buyer as Profile;

  if (body.lines.length === 0) return NextResponse.json({ error: "empty order" }, { status: 400 });

  const productIds = body.lines.map((l) => l.productId);
  const isB2B = body.orderType === "b2b";

  // Re-resolve every unit price server-side. Anything the client sent for
  // unitPrice is ignored — the cart submits user-controllable JSON.
  //
  // The visibility flags (is_active / private / available_b2b / available_dtc
  // / available_this_week) mirror the amend route's gates so a buyer can't
  // bypass the catalog by POSTing a stale or hidden product id. RLS would
  // catch this for buyer sessions, but admin impersonation uses the service
  // client which bypasses RLS — so we re-check in code here too.
  const { data: productsData, error: productsErr } = await svc
    .from("products")
    .select(
      "id, name, pack_size, wholesale_price, retail_price, is_active, private, available_b2b, available_dtc, available_this_week",
    )
    .in("id", productIds);
  if (productsErr) return NextResponse.json({ error: productsErr.message }, { status: 500 });
  type ProductRow = {
    id: string;
    name: string;
    pack_size: string | null;
    wholesale_price: number | null;
    retail_price: number | null;
    is_active: boolean;
    private: boolean;
    available_b2b: boolean;
    available_dtc: boolean;
    available_this_week: boolean;
  };
  const productById = new Map(
    ((productsData as ProductRow[] | null) ?? []).map((p) => [p.id, p]),
  );
  for (const id of productIds) {
    if (!productById.has(id)) {
      return NextResponse.json({ error: `product ${id} no longer available` }, { status: 400 });
    }
  }

  // Private-product allow-list lookup. DTC and no-account buyers get []
  // and therefore see no private SKUs (matches the public catalog query).
  const allowedPrivateIds = await getAllowedPrivateProductIds(
    svc,
    effectiveProfile.account_id ?? null,
  );
  const allowedPrivateSet = new Set(allowedPrivateIds);

  for (const id of productIds) {
    const product = productById.get(id)!;
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
      // Generic message — don't reveal that a private SKU exists to an
      // account that isn't on its allow-list.
      return NextResponse.json(
        { error: `${product.name} isn't available for your account` },
        { status: 400 },
      );
    }
  }

  let accountRow: Account | null = null;
  if (effectiveProfile.account_id) {
    const { data: acct } = await svc.from("accounts").select("*").eq("id", effectiveProfile.account_id).maybeSingle();
    accountRow = (acct as Account | null) ?? null;
  }

  // Use the same pricing pipeline as the catalog and standing-order cron:
  // overrides → assigned price list → tier multiplier.
  const pricingCtx = await loadPricingContext(svc, accountRow, isB2B);

  const pricedLines = body.lines.map((l) => {
    const product = productById.get(l.productId)!;
    const unitPrice = priceForProduct(product, pricingCtx);
    return { ...l, unitPrice, productName: product.name as string, packSize: product.pack_size as string | null };
  });
  const unpriceable = pricedLines.find((l) => l.unitPrice == null);
  if (unpriceable) {
    return NextResponse.json(
      { error: `pricing not configured for ${unpriceable.productName}` },
      { status: 400 },
    );
  }

  const subtotal = round2(pricedLines.reduce((s, l) => s + l.quantity * (l.unitPrice as number), 0));

  // Delivery fee + minimum: pulled from the buyer's account → delivery zone.
  // B2B only; DTC pickups don't carry a zone fee today. Account-level
  // order_minimum overrides the zone minimum when set.
  let deliveryFee = 0;
  let orderMinimum = 0;
  if (isB2B && accountRow) {
    let zoneRow: DeliveryZoneRow | null = null;
    if (accountRow.delivery_zone) {
      const { data: zone } = await svc
        .from("delivery_zones")
        .select("delivery_fee, order_minimum")
        .eq("zone", accountRow.delivery_zone)
        .maybeSingle();
      zoneRow = zone as DeliveryZoneRow | null;
      deliveryFee = Number(zoneRow?.delivery_fee ?? 0);
    }
    // Single source of truth shared with the cart RSC so the two layers
    // can't drift: account override → zone fallback → 0.
    orderMinimum = effectiveOrderMinimum(accountRow, zoneRow);
  }
  const total = round2(subtotal + deliveryFee);

  // Re-enforce the cart-side minimum on the server. The cart UI gates the
  // "Place order" button on this, but a misbehaving client (or a paused
  // React state) could submit anyway — reject here so we never accept
  // under-minimum revenue. Uses the same shared helper as the cart UI
  // so the two layers can't disagree on the rule.
  if (!meetsMinimum({ subtotal, deliveryFee, minimum: orderMinimum })) {
    return NextResponse.json(
      { error: `Order is below the minimum of $${orderMinimum.toFixed(2)} (subtotal + delivery).` },
      { status: 400 },
    );
  }

  const { data: orderNumRow, error: numErr } = await svc.rpc("generate_order_number");
  if (numErr) return NextResponse.json({ error: numErr.message }, { status: 500 });
  const order_number = (orderNumRow as unknown as string) ?? `FLF-${Date.now()}`;

  // For Stripe-paid orders: create the checkout session BEFORE the orders
  // insert. If Stripe throws we abort with no DB writes (no stranded draft
  // order, no misleading "order placed" system message). We pre-generate
  // the order id locally so we can both pass it as session metadata AND
  // populate the insert row's stripe_payment_id atomically.
  let preGeneratedOrderId: string | null = null;
  let stripeCheckoutUrl: string | null = null;
  let stripeSessionId: string | null = null;
  if (body.paymentMethod === "stripe") {
    try {
      const stripe = getStripe();
      const lineItems = pricedLines.map((l) => ({
        quantity: l.quantity,
        price_data: {
          currency: "usd",
          unit_amount: Math.round((l.unitPrice as number) * 100),
          product_data: {
            name: l.productName,
            description: l.packSize ?? undefined,
          },
        },
      }));
      if (deliveryFee > 0) {
        lineItems.push({
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(deliveryFee * 100),
            product_data: { name: "Delivery fee", description: undefined },
          },
        });
      }
      preGeneratedOrderId = crypto.randomUUID();
      const checkout = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: lineItems,
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/orders/${preGeneratedOrderId}?paid=1`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cart`,
        metadata: { order_id: preGeneratedOrderId },
      });
      stripeCheckoutUrl = checkout.url;
      stripeSessionId = checkout.id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: `Stripe: ${msg}` }, { status: 500 });
    }
  }

  // orders.account_id is NOT NULL in the DB; effectiveProfile.account_id
  // can technically be null (legacy DTC paths) so we coerce and let RLS /
  // FK reject if a DTC buyer somehow hits this path without an account.
  const orderInsertRow: TablesInsert<"orders"> = {
    order_number,
    order_type: body.orderType,
    status: body.paymentMethod === "stripe" ? "draft" : "pending",
    profile_id: effectiveProfile.id,
    account_id: effectiveProfile.account_id as string,
    placed_by_id: placedById,
    requested_delivery_date: body.requestedDeliveryDate,
    pickup_date: body.pickupDate,
    pickup_location_id: body.pickupLocationId,
    subtotal,
    delivery_fee: deliveryFee,
    total,
    payment_method: body.paymentMethod,
    customer_notes: body.customerNotes,
  };
  if (preGeneratedOrderId) orderInsertRow.id = preGeneratedOrderId;
  if (stripeSessionId) orderInsertRow.stripe_payment_id = stripeSessionId;

  const { data: order, error: orderErr } = await svc
    .from("orders")
    .insert(orderInsertRow)
    .select("*")
    .single();
  if (orderErr || !order) {
    // Stripe succeeded but the DB write failed — best-effort expire the
    // session so the buyer can't pay against a now-orphaned checkout.
    // We swallow any expire error: the session will time out on its own
    // and the webhook's ownership check refuses to mutate an order it
    // can't find by stripe_payment_id, so a late payment is contained.
    if (stripeSessionId) {
      try { await getStripe().checkout.sessions.expire(stripeSessionId); } catch { /* tolerated */ }
    }
    return NextResponse.json({ error: orderErr?.message ?? "order failed" }, { status: 500 });
  }

  const itemRows = pricedLines.map((l) => ({
    order_id: order.id,
    product_id: l.productId,
    quantity: l.quantity,
    unit_price: l.unitPrice as number,
    line_total: round2(l.quantity * (l.unitPrice as number)),
    notes: l.notes,
    pack_variant_key: l.variantKey ?? null,
    pack_variant_sku: l.variantSku ?? null,
  }));
  const { error: itemsErr } = await svc.from("order_items").insert(itemRows);
  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });

  // Analytics: stamp the order_placed event. Best-effort, never throws.
  // Done server-side so we can't miss it (client tracking would skip the
  // event on a slow connection or a fast redirect).
  void trackServer(svc, {
    event: "order_placed",
    profileId: effectiveProfile.id,
    accountId: effectiveProfile.account_id,
    properties: {
      order_id: order.id,
      order_number,
      order_type: body.orderType,
      payment_method: body.paymentMethod,
      line_count: body.lines.length,
      item_count: body.lines.reduce((s, l) => s + l.quantity, 0),
      subtotal,
      delivery_fee: deliveryFee,
      total,
      placed_by: placedById ? "admin_impersonation" : "buyer",
    },
  });

  // Buyer's order-history aggregate just changed — drop the cached
  // buyer-history entry so /guide and /catalog re-read fresh numbers.
  revalidateTag(buyerHistoryTag(effectiveProfile.id), "max");

  // Post an order summary into the account's chat thread. Stored as a
  // structured payload so the chat UI can render a rich card without
  // regex-parsing the body.
  if (effectiveProfile.account_id) {
    const itemCount = body.lines.reduce((s, l) => s + l.quantity, 0);
    const deliverPart = body.requestedDeliveryDate
      ? ` · deliver ${formatDateShort(body.requestedDeliveryDate)}`
      : body.pickupDate
      ? ` · pickup ${formatDateShort(body.pickupDate)}`
      : "";
    const summary = `Order ${order_number} placed · ${itemCount} ${itemCount === 1 ? "item" : "items"} · ${formatMoney(total)}${deliverPart}`;
    await svc.from("messages").insert({
      account_id: effectiveProfile.account_id,
      from_profile_id: null,
      to_profile_id: null,
      body: summary,
      channel: "app",
      direction: "outbound",
      is_system: true,
      related_order_id: order.id,
      payload: {
        kind: "order_placed",
        order_id: order.id,
        order_number,
        items: itemCount,
        subtotal,
        delivery_fee: deliveryFee,
        total,
        delivery_date: body.requestedDeliveryDate,
        pickup_date: body.pickupDate,
      },
    });
  }

  if (body.paymentMethod === "stripe") {
    return NextResponse.json({ orderId: order.id, stripeUrl: stripeCheckoutUrl });
  }

  // Deliver order confirmation on every available channel. The two are
  // independent — a buyer who opted out of SMS still gets the email
  // paper trail, and vice versa.
  //
  // Fire-and-forget via `after()` so a slow Twilio/Resend response can't
  // blow the Vercel 10s budget after the DB writes have already succeeded.
  // Previously, sequential awaits here could leave the buyer with a
  // network-error toast on a successfully-placed order, prompting a
  // retry → duplicate. Promise.allSettled inside `after` so one channel
  // failing doesn't compound; failures are surfaced via console.error
  // (Vercel logs) because the response is long gone and the notifications
  // row already records its own status on send failure.
  const phone = effectiveProfile.phone;
  const email = effectiveProfile.email;
  const itemCount = body.lines.reduce((s, l) => s + l.quantity, 0);
  const emailBody = [
    `We got your order ${order_number}.`,
    "",
    `Items: ${itemCount}`,
    `Subtotal: ${formatMoney(subtotal)}`,
    deliveryFee > 0 ? `Delivery: ${formatMoney(deliveryFee)}` : null,
    `Total: ${formatMoney(total)}`,
    body.requestedDeliveryDate
      ? `Delivery: ${formatDateShort(body.requestedDeliveryDate)}`
      : body.pickupDate
        ? `Pickup: ${formatDateShort(body.pickupDate)}`
        : null,
    "",
    "We'll let you know when it's confirmed and ready.",
  ]
    .filter(Boolean)
    .join("\n");

  after(async () => {
    const tasks: Promise<unknown>[] = [];
    if (phone) {
      tasks.push(
        enqueueAndSend({
          supabase: svc,
          profileId: effectiveProfile.id,
          accountId: effectiveProfile.account_id,
          type: "order_confirmation",
          channel: "sms",
          toAddress: phone,
          body: `FLF: order ${order_number} received · ${formatMoney(total)}. We'll text you when it's ready.`,
          relatedOrderId: order.id,
        }),
      );
    }
    if (email) {
      tasks.push(
        enqueueAndSend({
          supabase: svc,
          profileId: effectiveProfile.id,
          accountId: effectiveProfile.account_id,
          type: "order_confirmation",
          channel: "email",
          toAddress: email,
          subject: `Order ${order_number} received — Fingerlakes Farms`,
          body: emailBody,
          relatedOrderId: order.id,
        }),
      );
    }
    const results = await Promise.allSettled(tasks);
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(
          `[orders/create] notification ${i} for order ${order_number} threw:`,
          r.reason,
        );
      } else if (r.value && typeof r.value === "object" && "ok" in r.value && !(r.value as { ok: boolean }).ok) {
        // enqueueAndSend swallows errors and returns { ok:false, error } —
        // still log so we don't silently drop an SMS/email.
        console.warn(
          `[orders/create] notification ${i} for order ${order_number} not delivered:`,
          (r.value as { error?: string }).error,
        );
      }
    });
  });

  return NextResponse.json({ orderId: order.id });
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
function formatMoney(n: number): string { return `$${n.toFixed(2)}`; }
function formatDateShort(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
