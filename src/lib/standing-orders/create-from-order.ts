import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { Order, OrderItem, StandingFreq } from "@/lib/supabase/types";
import { computeNextRun } from "@/lib/utils/standing-order";
import { BUSINESS_TIMEZONE, DAY_NAMES } from "@/lib/constants";

export type CreateFromOrderResult =
  | { ok: true; standingOrderId: string; created: boolean }
  | { ok: false; error: string; status: number };

/**
 * Materialize a one-shot order into a recurring standing order.
 *
 * Idempotency: a standing order created from a given source order is
 * traceable via standing_orders.name (we stamp the source order_number into
 * the name). If a standing order with the same source-order signature
 * already exists for this account, return it instead of creating a duplicate.
 *
 * Failure semantics mirror lib/standing-orders/run.ts: if the items insert
 * fails after the header insert succeeded, compensating-delete the orphan
 * header so we don't leave an empty standing order behind.
 */
export async function createStandingOrderFromOrder(
  svc: SupabaseClient<Database>,
  args: {
    sourceOrder: Order;
    daysOfWeek: string[]; // values from DAY_NAMES, e.g. ["Tuesday", "Friday"]
    cadence: StandingFreq;
    requireConfirmation?: boolean;
  },
): Promise<CreateFromOrderResult> {
  const { sourceOrder: o, daysOfWeek, cadence } = args;
  const requireConfirmation = args.requireConfirmation ?? true;

  // Validate days_of_week values up front — RLS will reject garbage but the
  // error string is opaque; better to fail with a 400 we control.
  const invalidDay = daysOfWeek.find(
    (d) => !DAY_NAMES.includes(d as (typeof DAY_NAMES)[number]),
  );
  if (invalidDay) {
    return { ok: false, error: `invalid day: ${invalidDay}`, status: 400 };
  }
  if (!daysOfWeek.length) {
    return { ok: false, error: "pick at least one day", status: 400 };
  }
  if (cadence !== "weekly" && cadence !== "biweekly") {
    return { ok: false, error: "invalid cadence", status: 400 };
  }

  if (!o.account_id) {
    return { ok: false, error: "order has no account", status: 400 };
  }

  // Idempotency probe: name carries "from order FLF-…" so a second submit
  // for the same source order returns the existing standing order id
  // instead of duplicating it. Buyers re-tapping the post-submit prompt
  // shouldn't end up with two recurring orders for the same lines.
  const sourceName = `From order ${o.order_number}`;
  const { data: existing } = await svc
    .from("standing_orders")
    .select("id")
    .eq("account_id", o.account_id)
    .eq("name", sourceName)
    .maybeSingle();
  if (existing) {
    return {
      ok: true,
      standingOrderId: (existing as { id: string }).id,
      created: false,
    };
  }

  // Hydrate items from the source order. We don't deep-copy unit_price /
  // line_total — the standing-order cron re-prices via loadPricingContext on
  // every run, which is the source of truth for B2B recurring pricing.
  const { data: itemRows, error: itemsErr } = await svc
    .from("order_items")
    .select("product_id, quantity, notes")
    .eq("order_id", o.id);
  if (itemsErr) {
    return { ok: false, error: `items load: ${itemsErr.message}`, status: 500 };
  }
  const items = (itemRows as { product_id: string; quantity: number; notes: string | null }[] | null) ?? [];
  if (!items.length) {
    return { ok: false, error: "source order has no items", status: 400 };
  }

  const nextRun = computeNextRun(
    {
      active: true,
      days_of_week: daysOfWeek,
      frequency: cadence,
      last_run_date: null,
      pause_until: null,
    },
    new Date(),
    BUSINESS_TIMEZONE,
  );

  const { data: header, error: headerErr } = await svc
    .from("standing_orders")
    .insert({
      account_id: o.account_id,
      profile_id: o.profile_id,
      name: sourceName,
      frequency: cadence,
      days_of_week: daysOfWeek,
      require_confirmation: requireConfirmation,
      active: true,
      next_run_date: nextRun ? nextRun.toISOString().slice(0, 10) : null,
    })
    .select("id")
    .single();
  if (headerErr || !header) {
    return {
      ok: false,
      error: `standing order create: ${headerErr?.message ?? "unknown"}`,
      status: 500,
    };
  }
  const standingOrderId = (header as { id: string }).id;

  const { error: insErr } = await svc.from("standing_order_items").insert(
    items.map((it) => ({
      standing_order_id: standingOrderId,
      product_id: it.product_id,
      quantity: it.quantity,
      notes: it.notes,
    })),
  );
  if (insErr) {
    // Compensating delete — same pattern as runStandingOrder. Don't leave a
    // headerless / orphan-with-no-items standing order around for the cron
    // to choke on.
    const { error: cleanupErr } = await svc
      .from("standing_orders")
      .delete()
      .eq("id", standingOrderId);
    if (cleanupErr) {
      console.error(
        `[createStandingOrderFromOrder] items insert failed and cleanup also failed for ${standingOrderId}:`,
        cleanupErr,
      );
    }
    return {
      ok: false,
      error: `standing items insert: ${insErr.message}`,
      status: 500,
    };
  }

  return { ok: true, standingOrderId, created: true };
}

/**
 * Pick a sensible default day-of-week from a source order. Uses the
 * delivery date (or pickup date) as the seed; falls back to today's
 * weekday in the business timezone if the order has neither.
 */
export function defaultDayFromOrder(o: Pick<Order, "requested_delivery_date" | "pickup_date">): string {
  const iso = o.requested_delivery_date ?? o.pickup_date;
  if (iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return DAY_NAMES[d.getDay()];
    }
  }
  return DAY_NAMES[new Date().getDay()];
}

/**
 * Pull the `OrderItem`-shaped subset we need for the materialization. Kept
 * separate so a page can probe row-count without fetching `product:products(*)`.
 */
export async function loadOrderItemsForStanding(
  svc: SupabaseClient<Database>,
  orderId: string,
): Promise<Pick<OrderItem, "product_id" | "quantity" | "notes">[]> {
  const { data } = await svc
    .from("order_items")
    .select("product_id, quantity, notes")
    .eq("order_id", orderId);
  return (data as Pick<OrderItem, "product_id" | "quantity" | "notes">[] | null) ?? [];
}
