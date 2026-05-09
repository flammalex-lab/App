import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { createServiceClient } from "@/lib/supabase/server";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type Svc = SupabaseClient<any, any, any>;

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

  // Pre-flight dedupe: if we've already recorded this event.id, short-circuit.
  // We do *not* insert the dedupe row yet — that happens last, AFTER the
  // mutation succeeds, so a transient failure during update doesn't leave
  // the order permanently desynced (Stripe's retry would then hit the
  // dedupe row instead of re-applying the change).
  const { data: existing } = await svc
    .from("stripe_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ received: true, deduped: true });
  }

  let mutationError: string | null = null;
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const id = session.metadata?.order_id;
      if (id) {
        const { error } = await svc.from("orders").update({
          status: "confirmed",
          payment_status: "paid",
          stripe_payment_id: (session.payment_intent as string) ?? session.id,
        }).eq("id", id);
        if (error) mutationError = error.message;
      }
      break;
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      // Only flip payment_status. Don't reset status to 'draft' — that
      // would clobber an admin-placed order that's already pending /
      // confirmed and yank it out of the buyer's order list.
      const orderId = await orderIdForPaymentIntent(svc, pi);
      if (orderId) {
        const { error } = await svc.from("orders").update({
          payment_status: "failed",
        }).eq("id", orderId);
        if (error) mutationError = error.message;
      }
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      // Disputes/refunds rarely carry our metadata. Fall back to looking
      // up by stripe_payment_id when metadata.order_id is missing.
      const orderId = await orderIdForCharge(svc, charge);
      if (orderId) {
        const fullyRefunded = charge.amount_refunded >= charge.amount;
        const update: { payment_status: string; status?: string } = {
          payment_status: fullyRefunded ? "refunded" : "partially_refunded",
        };
        if (fullyRefunded) update.status = "cancelled";
        const { error } = await svc.from("orders").update(update).eq("id", orderId);
        if (error) mutationError = error.message;
      }
      break;
    }
    case "charge.dispute.created": {
      // Dispute objects have their own metadata bag and do NOT inherit
      // anything from the underlying charge — so dispute.metadata.order_id
      // is virtually always undefined. Resolve via dispute.payment_intent
      // (or dispute.charge) → orders.stripe_payment_id.
      const dispute = event.data.object as Stripe.Dispute;
      const orderId = await orderIdForDispute(svc, dispute);
      if (orderId) {
        const { error } = await svc.from("orders").update({
          payment_status: "disputed",
        }).eq("id", orderId);
        if (error) mutationError = error.message;
      }
      break;
    }
    default:
      // Other events: just record audit row.
      break;
  }

  // If the mutation failed, do NOT record the dedupe row. Stripe will retry
  // on a non-2xx and the next attempt can re-apply the change cleanly.
  if (mutationError) {
    return NextResponse.json({ error: mutationError }, { status: 500 });
  }

  // Mutation succeeded (or was a no-op) — now safe to dedupe future retries.
  // If this insert itself fails (rare; UNIQUE violation race or DB hiccup),
  // we let Stripe retry — the mutation is idempotent because every branch
  // is "set fields to a known state by id", so re-applying is a no-op.
  await svc.from("stripe_events").insert({
    id: event.id,
    type: event.type,
    order_id: extractOrderId(event),
  });

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

async function orderIdForPaymentIntent(svc: Svc, pi: Stripe.PaymentIntent): Promise<string | null> {
  const fromMeta = pi.metadata?.order_id;
  if (fromMeta) return fromMeta;
  return orderIdByStripePaymentId(svc, pi.id);
}

async function orderIdForCharge(svc: Svc, charge: Stripe.Charge): Promise<string | null> {
  const fromMeta = charge.metadata?.order_id;
  if (fromMeta) return fromMeta;
  // Charges link to the PaymentIntent we stored on orders.stripe_payment_id.
  const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (piId) return orderIdByStripePaymentId(svc, piId);
  return null;
}

async function orderIdForDispute(svc: Svc, dispute: Stripe.Dispute): Promise<string | null> {
  const fromMeta = (dispute.metadata as Record<string, string> | undefined)?.order_id;
  if (fromMeta) return fromMeta;
  const piId = typeof dispute.payment_intent === "string"
    ? dispute.payment_intent
    : dispute.payment_intent?.id;
  if (piId) return orderIdByStripePaymentId(svc, piId);
  return null;
}

async function orderIdByStripePaymentId(svc: Svc, paymentId: string): Promise<string | null> {
  const { data } = await svc.from("orders").select("id").eq("stripe_payment_id", paymentId).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}
