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
  // Insert the row FIRST and let Postgres's UNIQUE(id) constraint do the
  // work — winner of the race gets a returned row, loser sees SQLSTATE
  // 23505 which we catch as "already processed". Mutation only runs on
  // the winner. If the mutation then fails, we DELETE the dedupe row so
  // Stripe's retry can re-apply cleanly. (We could equivalently use
  // .upsert({}, { onConflict: 'id', ignoreDuplicates: true }) — the
  // 23505 path is just more explicit about the dedupe signal.)
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

  // ---- Mutation branches ----
  // INVARIANT: every branch below must be idempotent — if the same event is
  // applied twice (rollback-then-retry race window, or a rare double-claim),
  // the second apply must produce the same end state. Today this holds because
  // every branch is "set fields to a known state by id". DON'T add side
  // effects here that aren't idempotent (e.g. SMS dispatch, email send,
  // counter increments) without first introducing a `processed_at` column on
  // orders + a `where processed_at is null` guard on the update.
  let mutationError: string | null = null;
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const id = session.metadata?.order_id;
        if (id) {
          // Ownership check: the order's stored stripe_payment_id was set to
          // the session id at /api/orders/create time. Scope the update by
          // BOTH the metadata-supplied order_id AND the matching session id
          // so a forged metadata.order_id targeting someone else's order
          // can't flip its status. Done in the WHERE clause (not a select-
          // then-update) so the check is atomic at the DB.
          const { data: updated, error } = await svc.from("orders").update({
            status: "confirmed",
            payment_status: "paid",
            stripe_payment_id: (session.payment_intent as string) ?? session.id,
          }).eq("id", id).eq("stripe_payment_id", session.id).select("id");
          if (error) mutationError = error.message;
          else if (!updated || updated.length === 0) {
            // metadata.order_id didn't match the order this session belongs
            // to. Log and 200 — returning 500 would make Stripe retry an
            // unwinnable mutation. Mutation is intentionally skipped.
            console.warn("[stripe webhook] checkout.session.completed: metadata.order_id does not match order's stripe_payment_id", { eventId: event.id, sessionId: session.id, metadataOrderId: id });
          }
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
  // (There's a tiny race window where Stripe's retry could arrive before this
  // delete commits, win the insert race, and apply the same mutation a second
  // time. Every webhook branch above is idempotent — set-fields-to-known-state-
  // by-id — so the duplicate is harmless.)
  if (mutationError) {
    // Surface a clearer hint when the failure is an enum-violation: the most
    // common cause is migration 0020 not being applied, which extends
    // payment_status_t with the new states the webhook writes. Saves an
    // operator a debugging trip when Stripe starts retrying.
    if (looksLikeEnumViolation(mutationError)) {
      console.error("[stripe webhook] enum violation — likely migration 0020 not applied:", mutationError);
    }
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

/**
 * Rough-detect a Postgres enum-violation by message text. Used only for
 * a clearer ops log line — we don't gate behavior on this match.
 */
function looksLikeEnumViolation(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("invalid input value for enum") || m.includes("payment_status_t");
}

async function orderIdForPaymentIntent(svc: Svc, pi: Stripe.PaymentIntent): Promise<string | null> {
  // Ownership-safe lookup: prefer the stripe_payment_id index (set when
  // checkout.session.completed wrote the PI id into the row). Falling
  // back to metadata.order_id alone would let an attacker with API-key
  // access mark an arbitrary order as failed by crafting a PI with that
  // metadata; verify the metadata-claimed order actually points back at
  // this PI before trusting it.
  const byPI = await orderIdByStripePaymentId(svc, pi.id);
  if (byPI) return byPI;
  const fromMeta = pi.metadata?.order_id;
  if (fromMeta) return orderIdIfMatchesStripeId(svc, fromMeta, pi.id);
  return null;
}

async function orderIdForCharge(svc: Svc, charge: Stripe.Charge): Promise<string | null> {
  const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (piId) {
    const byPI = await orderIdByStripePaymentId(svc, piId);
    if (byPI) return byPI;
    const fromMeta = charge.metadata?.order_id;
    if (fromMeta) return orderIdIfMatchesStripeId(svc, fromMeta, piId);
  }
  return null;
}

async function orderIdForDispute(svc: Svc, dispute: Stripe.Dispute): Promise<string | null> {
  const piId = typeof dispute.payment_intent === "string"
    ? dispute.payment_intent
    : dispute.payment_intent?.id;
  if (piId) {
    const byPI = await orderIdByStripePaymentId(svc, piId);
    if (byPI) return byPI;
    const fromMeta = (dispute.metadata as Record<string, string> | undefined)?.order_id;
    if (fromMeta) return orderIdIfMatchesStripeId(svc, fromMeta, piId);
  }
  return null;
}

async function orderIdByStripePaymentId(svc: Svc, paymentId: string): Promise<string | null> {
  const { data } = await svc.from("orders").select("id").eq("stripe_payment_id", paymentId).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * Verify that a metadata-supplied order id actually belongs to the given
 * Stripe payment. Guards against forged metadata.order_id targeting a
 * different account's order. Returns the id only if the row's
 * stripe_payment_id matches.
 */
async function orderIdIfMatchesStripeId(svc: Svc, orderId: string, stripeId: string): Promise<string | null> {
  const { data } = await svc.from("orders").select("id").eq("id", orderId).eq("stripe_payment_id", stripeId).maybeSingle();
  if ((data as { id: string } | null)?.id) return orderId;
  console.warn("[stripe webhook] metadata.order_id does not match stripe_payment_id on row — skipping", { orderId, stripeId });
  return null;
}
