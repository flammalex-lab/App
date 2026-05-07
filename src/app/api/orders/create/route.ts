import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { getImpersonation } from "@/lib/auth/impersonation";
import { getStripe } from "@/lib/stripe/client";
import type { OrderType, PaymentMethod, Profile, DeliveryZoneRow, Account } from "@/lib/supabase/types";
import { enqueueAndSend } from "@/lib/notifications/dispatch";

interface BodyLine {
  productId: string;
  quantity: number;
  unitPrice: number;
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
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json()) as Body;

  const impersonating = session.profile.role === "admin" ? getImpersonation() : null;
  const actingAsId = impersonating ?? session.userId;
  const placedById = impersonating ? session.userId : null;

  const svc = createServiceClient();
  const { data: buyer } = await svc.from("profiles").select("*").eq("id", actingAsId).maybeSingle();
  if (!buyer) return NextResponse.json({ error: "profile not found" }, { status: 400 });
  const effectiveProfile = buyer as Profile;

  if (body.lines.length === 0) return NextResponse.json({ error: "empty order" }, { status: 400 });

  const subtotal = round2(body.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0));

  // Delivery fee: pulled from the buyer's account → delivery zone.
  // B2B only; DTC pickups don't carry a zone fee today.
  let deliveryFee = 0;
  if (body.orderType === "b2b" && effectiveProfile.account_id) {
    const { data: acct } = await svc
      .from("accounts")
      .select("delivery_zone")
      .eq("id", effectiveProfile.account_id)
      .maybeSingle();
    const zoneKey = (acct as Account | null)?.delivery_zone ?? null;
    if (zoneKey) {
      const { data: zone } = await svc
        .from("delivery_zones")
        .select("delivery_fee")
        .eq("zone", zoneKey)
        .maybeSingle();
      deliveryFee = Number((zone as DeliveryZoneRow | null)?.delivery_fee ?? 0);
    }
  }
  const total = round2(subtotal + deliveryFee);

  const { data: orderNumRow, error: numErr } = await svc.rpc("generate_order_number");
  if (numErr) return NextResponse.json({ error: numErr.message }, { status: 500 });
  const order_number = (orderNumRow as unknown as string) ?? `FLF-${Date.now()}`;

  const { data: order, error: orderErr } = await svc
    .from("orders")
    .insert({
      order_number,
      order_type: body.orderType,
      status: body.paymentMethod === "stripe" ? "draft" : "pending",
      profile_id: effectiveProfile.id,
      account_id: effectiveProfile.account_id,
      placed_by_id: placedById,
      requested_delivery_date: body.requestedDeliveryDate,
      pickup_date: body.pickupDate,
      pickup_location_id: body.pickupLocationId,
      subtotal,
      delivery_fee: deliveryFee,
      total,
      payment_method: body.paymentMethod,
      customer_notes: body.customerNotes,
    })
    .select("*")
    .single();
  if (orderErr || !order) return NextResponse.json({ error: orderErr?.message ?? "order failed" }, { status: 500 });

  const itemRows = body.lines.map((l) => ({
    order_id: order.id,
    product_id: l.productId,
    quantity: l.quantity,
    unit_price: l.unitPrice,
    line_total: round2(l.quantity * l.unitPrice),
    notes: l.notes,
    pack_variant_key: l.variantKey ?? null,
    pack_variant_sku: l.variantSku ?? null,
  }));
  const { error: itemsErr } = await svc.from("order_items").insert(itemRows);
  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });

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

  // Stripe checkout if DTC card
  if (body.paymentMethod === "stripe") {
    try {
      const stripe = getStripe();
      const { data: products } = await svc
        .from("products")
        .select("id,name,pack_size")
        .in("id", body.lines.map((l) => l.productId));
      const nameById = Object.fromEntries(((products ?? []) as any[]).map((p) => [p.id, p]));
      const lineItems = body.lines.map((l) => ({
        quantity: l.quantity,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(l.unitPrice * 100),
          product_data: {
            name: nameById[l.productId]?.name ?? "Item",
            description: nameById[l.productId]?.pack_size ?? undefined,
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
      const checkout = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: lineItems,
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/orders/${order.id}?paid=1`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cart`,
        metadata: { order_id: order.id },
      });
      await svc.from("orders").update({ stripe_payment_id: checkout.id }).eq("id", order.id);
      return NextResponse.json({ orderId: order.id, stripeUrl: checkout.url });
    } catch (e: any) {
      return NextResponse.json({ error: `Stripe: ${e.message}` }, { status: 500 });
    }
  }

  const phone = effectiveProfile.phone;
  if (phone) {
    await enqueueAndSend({
      supabase: svc,
      profileId: effectiveProfile.id,
      accountId: effectiveProfile.account_id,
      type: "order_confirmation",
      channel: "sms",
      toAddress: phone,
      body: `FLF: order ${order_number} received · ${formatMoney(total)}. We'll text you when it's ready.`,
      relatedOrderId: order.id,
    });
  }

  return NextResponse.json({ orderId: order.id });
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
function formatMoney(n: number): string { return `$${n.toFixed(2)}`; }
function formatDateShort(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
