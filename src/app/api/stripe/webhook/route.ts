import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { createServiceClient } from "@/lib/supabase/server";
import type Stripe from "stripe";

export const runtime = "nodejs";

type Svc = ReturnType<typeof createServiceClient>;

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

  // ---- Race-safe dedupe ----
  // Insert the row FIRST with on-conflict-do-nothing; the RETURNING tells
  // us whether we won the race (row inserted) or lost (no row, because
  // another concurrent delivery or a retry already inserted). Mutation
  // only runs on the winner. If the mutation then fails, we DELETE the
  // dedupe row so Stripe's retry can re-apply cleanly.
  const orderIdHint = extractOrderId(event);
  const { data: claimed, error: claimErr } = await svc
    .from("stripe_events")
    .insert({ id: event.id, type: event.type, order_id: orderIdHint })
    .select("id")
    .maybeSingle();
  if (claimErr) {
    // Lost the race / already processed — Postgres SQLSTATE 23505. PostgREST
    // surfaces this on `.code` most of the time but occasionally only via
    // `.message` / `.details`, so check all three to avoid 500-looping
    // Stripe retries.
    if (isUniqueViolation(claimErr)) {
      return NextResponse.json({ received: true, deduped: true });
    }
    return NextResponse.json({ error: claimErr.message }, { status: 500 });
  }
  if (!claimed) {
    // Insert returned no row and no error. The benign cause is "row
    // already exists" (RLS hides it from RETURNING, or PostgREST collapses
    // a no-op to null) — but if that's true, a SELECT should find the
    // prior row. If it doesn't, something's wrong (most likely an RLS
    // misconfig that's *silently dropping the insert*) — refuse to
    // short-circuit and force Stripe to retry so the failure is loud.
    const { data: prior } = await svc
      .from("stripe_events")
      .select("id")
      .eq("id", event.id)
      .maybeSingle();
    if (prior) {
      return NextResponse.json({ received: true, deduped: true });
    }
    console.error("[stripe webhook] dedupe insert returned null with no row visible — possible RLS misconfig", { eventId: event.id, type: event.type });
    return NextResponse.json({ error: "dedupe row not persisted" }, { status: 500 });
  }

  let mutationError: string | null = null;
  try {
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
        const orderId = await orderIdForCharge(svc, charge);
        if (orderId) {
          // Out-of-order delivery guard: Stripe retries can deliver an
          // older partial-refund event after we've already processed a
          // full refund. We avoid the SELECT-then-UPDATE race by baking
          // the comparison into the WHERE clause:
          //  • Full refund: always wins (refunded + cancelled is the
          //    terminal state; re-applying is idempotent).
          //  • Partial refund: only flip if the order isn't already
          //    'refunded' (the .neq filter does the comparison atomically
          //    against whatever the row currently says).
          const fullyRefunded = charge.amount_refunded >= charge.amount;
          if (fullyRefunded) {
            const { error } = await svc
              .from("orders")
              .update({ payment_status: "refunded", status: "cancelled" })
              .eq("id", orderId);
            if (error) mutationError = error.message;
          } else {
            const { error } = await svc
              .from("orders")
              .update({ payment_status: "partially_refunded" })
              .eq("id", orderId)
              .neq("payment_status", "refunded");
            if (error) mutationError = error.message;
          }
        }
        break;
      }
      case "charge.dispute.created": {
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
        // Other events: dedupe row stays as audit; no mutation.
        break;
    }
  } catch (e) {
    mutationError = e instanceof Error ? e.message : "unknown mutation error";
  }

  // Mutation failed — roll back the dedupe claim so Stripe's retry can win.
  if (mutationError) {
    await svc.from("stripe_events").delete().eq("id", event.id);
    return NextResponse.json({ error: mutationError }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

function extractOrderId(event: Stripe.Event): string | null {
  const obj = event.data.object as unknown as { metadata?: Record<string, string> };
  return obj?.metadata?.order_id ?? null;
}

/**
 * Detect a Postgres unique-violation. Supabase / PostgREST reliably
 * surfaces SQLSTATE on `.code`, so we trust that exclusively here — a
 * substring fallback over `.message` could mask unrelated DB errors as
 * "already processed" and silently no-op a payment webhook (worst-case
 * for a Stripe handler). Anything that isn't 23505 falls through to the
 * 500 path so Stripe retries and the real failure surfaces in logs.
 */
function isUniqueViolation(err: { code?: string } | null): boolean {
  return err?.code === "23505";
}

async function orderIdForPaymentIntent(svc: Svc, pi: Stripe.PaymentIntent): Promise<string | null> {
  const fromMeta = pi.metadata?.order_id;
  if (fromMeta) return fromMeta;
  return orderIdByStripePaymentId(svc, pi.id);
}

async function orderIdForCharge(svc: Svc, charge: Stripe.Charge): Promise<string | null> {
  const fromMeta = charge.metadata?.order_id;
  if (fromMeta) return fromMeta;
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
