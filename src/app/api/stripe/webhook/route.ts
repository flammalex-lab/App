import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { createServiceClient } from "@/lib/supabase/server";
import type Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const payload = await request.text();
  const sig = request.headers.get("stripe-signature");
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, sig!, secret);
  } catch (e: any) {
    return NextResponse.json({ error: `bad signature: ${e.message}` }, { status: 400 });
  }

  const svc = createServiceClient();

  // Idempotency: short-circuit if we've already processed this event.id.
  // Stripe retries 5xx responses up to 3 days, so we MUST dedupe before
  // applying side effects (status flips, refunds, dispute flags).
  const orderId = extractOrderId(event);
  const { error: dedupeErr } = await svc.from("stripe_events").insert({
    id: event.id,
    type: event.type,
    order_id: orderId,
  });
  if (dedupeErr) {
    // 23505 = unique_violation — we've already handled this event.
    if ((dedupeErr as { code?: string }).code === "23505") {
      return NextResponse.json({ received: true, deduped: true });
    }
    return NextResponse.json({ error: dedupeErr.message }, { status: 500 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const id = session.metadata?.order_id;
      if (id) {
        await svc.from("orders").update({
          status: "confirmed",
          payment_status: "paid",
          stripe_payment_id: (session.payment_intent as string) ?? session.id,
        }).eq("id", id);
      }
      break;
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const id = pi.metadata?.order_id;
      if (id) {
        await svc.from("orders").update({
          payment_status: "failed",
          status: "draft",
        }).eq("id", id);
      }
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const id = charge.metadata?.order_id;
      if (id) {
        const fullyRefunded = charge.amount_refunded >= charge.amount;
        await svc.from("orders").update({
          payment_status: fullyRefunded ? "refunded" : "partially_refunded",
          status: fullyRefunded ? "cancelled" : undefined,
        }).eq("id", id);
      }
      break;
    }
    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      const id = (dispute.metadata as Record<string, string> | undefined)?.order_id;
      if (id) {
        await svc.from("orders").update({
          payment_status: "disputed",
        }).eq("id", id);
      }
      break;
    }
    default:
      // Other events are recorded in stripe_events for audit but no-op here.
      break;
  }

  return NextResponse.json({ received: true });
}

/**
 * Pull our internal order_id out of whichever event shape Stripe is
 * sending. Used to attribute the dedupe row even when the handler doesn't
 * mutate orders.
 */
function extractOrderId(event: Stripe.Event): string | null {
  const obj = event.data.object as unknown as { metadata?: Record<string, string> };
  return obj?.metadata?.order_id ?? null;
}
