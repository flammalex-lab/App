import type { SupabaseClient } from "@supabase/supabase-js";

type AnyDb = SupabaseClient<any, any, any>;

/**
 * One rhythm signal per product the buyer has ordered on this delivery
 * weekday in the recent past. The /guide draft uses these to pre-fill
 * Friday's order from the last four Fridays (or Tuesdays, etc.).
 *
 *  - averageQty   : last-4-occurrences average quantity for this product
 *                   on this weekday. Rounded to the nearest whole unit so
 *                   the qty input shows a sensible default.
 *  - mostRecentQty: qty on the most recent occurrence. When averageQty>0
 *                   but mostRecentQty===0, the buyer "usually orders this
 *                   but skipped last time" — the UI dims that row.
 *  - occurrenceCount: number of past occurrences sampled (1–4). One-time
 *                   buys carry less signal than a four-week rhythm; the
 *                   UI can hide single-occurrence noise.
 */
export interface RhythmLine {
  productId: string;
  averageQty: number;
  mostRecentQty: number;
  occurrenceCount: number;
}

/**
 * Order statuses that count toward "the buyer committed to this product
 * on this weekday." Excludes draft (never sent) and cancelled (revoked).
 * Mirrors the SmartShop "Recent buys" status filter in /guide page.tsx so
 * the two surfaces never disagree on what counts.
 */
const COMMITTED_STATUSES = [
  "confirmed",
  "processing",
  "ready",
  "shipped",
  "delivered",
] as const;

function weekdayOf(isoDate: string): number {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.exec(isoDate);
  if (dateOnly) {
    const [y, m, d] = isoDate.split("-").map(Number);
    return new Date(y, m - 1, d).getDay();
  }
  return new Date(isoDate).getDay();
}

/**
 * Load the buyer's rhythm: for each product they've ordered on the same
 * weekday as `targetDeliveryDate` in the recent past, return the
 * last-4-occurrences average quantity plus a "did they skip it last
 * time?" signal.
 *
 * Sampled scope: `requested_delivery_date` weekday matches the target
 * weekday, status is committed (not draft / not cancelled). We pull the
 * 60 most recent orders for the buyer (cheap, indexed on created_at),
 * filter to matching weekdays in JS, take the latest 4 occurrences, and
 * aggregate. 60 is a generous overfetch — even a 5-day-a-week buyer's
 * recent 12 weeks fit.
 *
 * Sorting: occurrenceCount desc, averageQty desc — products with a
 * stable rhythm float to the top of the draft, one-time buys sink.
 */
export async function loadDraftRhythm(
  db: AnyDb,
  profileId: string,
  targetDeliveryDate: string,
): Promise<RhythmLine[]> {
  const targetWeekday = weekdayOf(targetDeliveryDate);

  const { data: orderRows } = await db
    .from("orders")
    .select("id, requested_delivery_date, pickup_date, created_at, status")
    .eq("profile_id", profileId)
    .in("status", COMMITTED_STATUSES as unknown as string[])
    .order("created_at", { ascending: false })
    .limit(60);

  const orders = ((orderRows as
    | {
        id: string;
        requested_delivery_date: string | null;
        pickup_date: string | null;
        created_at: string;
      }[]
    | null) ?? []
  ).filter((o) => {
    const date = o.requested_delivery_date ?? o.pickup_date;
    if (!date) return false;
    return weekdayOf(date) === targetWeekday;
  });

  if (orders.length === 0) return [];

  // Most recent first. Bound to 4 occurrences — anything older isn't
  // "rhythm", it's archeology.
  const sampled = orders.slice(0, 4);
  const orderIds = sampled.map((o) => o.id);
  const mostRecentOrderId = sampled[0].id;

  const { data: itemRows } = await db
    .from("order_items")
    .select("product_id, quantity, order_id")
    .in("order_id", orderIds);

  // Aggregate per product.
  const byProduct = new Map<
    string,
    { totalQty: number; occurrences: Set<string>; mostRecentQty: number }
  >();
  for (const r of ((itemRows as
    | { product_id: string; quantity: number; order_id: string }[]
    | null) ?? [])) {
    const cur = byProduct.get(r.product_id) ?? {
      totalQty: 0,
      occurrences: new Set<string>(),
      mostRecentQty: 0,
    };
    const qty = Number(r.quantity ?? 0);
    cur.totalQty += qty;
    cur.occurrences.add(r.order_id);
    if (r.order_id === mostRecentOrderId) cur.mostRecentQty += qty;
    byProduct.set(r.product_id, cur);
  }

  const out: RhythmLine[] = [];
  for (const [productId, agg] of byProduct.entries()) {
    const occurrenceCount = agg.occurrences.size;
    if (occurrenceCount === 0) continue;
    const avg = agg.totalQty / occurrenceCount;
    // Round to whole units — the qty input is integer-only. Keep at least
    // 1 so a buyer who consistently ordered 1 unit doesn't see 0 pre-filled.
    const averageQty = Math.max(1, Math.round(avg));
    out.push({
      productId,
      averageQty,
      mostRecentQty: agg.mostRecentQty,
      occurrenceCount,
    });
  }

  out.sort((a, b) => {
    if (a.occurrenceCount !== b.occurrenceCount) {
      return b.occurrenceCount - a.occurrenceCount;
    }
    return b.averageQty - a.averageQty;
  });

  return out;
}
