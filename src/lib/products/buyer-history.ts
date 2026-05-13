import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";

/** One row per (product, producer) — pre-aggregated by the
 *  `buyer_product_history` Postgres function (see migration 0035).
 *  - qty: sum of quantity across the buyer's order_items
 *  - lastOrderedAt: max(orders.created_at) for that product
 *  - producer: the product's current producer (joined via products) */
export interface BuyerHistoryRow {
  product_id: string;
  qty: number;
  producer: string | null;
  lastOrderedAt: string | null;
}

/** Tag used to invalidate a single buyer's cached history. Order-placement
 *  code paths call `revalidateTag(buyerHistoryTag(profileId))` so the
 *  next read after a fresh order returns up-to-date numbers. */
export function buyerHistoryTag(profileId: string): string {
  return `buyer-history:${profileId}`;
}

/**
 * Single source of truth for "what has THIS buyer ordered, ever?". Three
 * downstream features derive from this one read:
 *   - last-ordered timestamp per product
 *   - per-producer order-frequency rank
 *   - "new from your producers" discovery filter (orderedProducers /
 *     orderedProductIds sets)
 *
 * Two layers of caching:
 *   1. React `cache()` — dedupes calls inside the same render so
 *      multiple helpers don't each issue a query.
 *   2. `unstable_cache` — persists across requests / users / devices
 *      in Vercel's data cache, keyed by profileId and tagged so we
 *      can blow the entry away on order placement. 1-hour revalidate
 *      is a defensive fallback (if a future write path forgets to
 *      call revalidateTag, stale data resolves itself eventually).
 *
 * The Postgres function aggregates server-side, so the cache stores
 * 50ish rows per buyer instead of every individual order_items row.
 */
export const getBuyerHistory = cache(
  async (profileId: string): Promise<BuyerHistoryRow[]> => {
    const fetcher = unstable_cache(
      async () => {
        const db = createServiceClient();
        const { data } = await db.rpc("buyer_product_history", {
          p_profile_id: profileId,
        });
        return ((data as any[] | null) ?? []).map((r) => ({
          product_id: r.product_id as string,
          qty: Number(r.qty ?? 0),
          producer: (r.producer ?? null) as string | null,
          lastOrderedAt: (r.last_ordered_at ?? null) as string | null,
        })) as BuyerHistoryRow[];
      },
      ["buyer-history", profileId],
      {
        tags: [buyerHistoryTag(profileId)],
        revalidate: 3600,
      },
    );
    return fetcher();
  },
);
