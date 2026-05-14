import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Db = SupabaseClient<Database>;

/**
 * Per-producer order-frequency ranking, scoped to a set of producers (the
 * producers represented in the current view). Returns two maps:
 *   - buyer: how often THIS buyer has ordered from each producer (sum of
 *     order_items.quantity across products from that producer);
 *   - global: overall popularity across all customers.
 *
 * Mirrors the logic in /guide (see src/app/(storefront)/guide/page.tsx) so
 * loyalty-sorted producer surfaces feel consistent across the buyer's day.
 *
 * The producers list bounds both queries so this stays cheap even when a
 * catalog group has thousands of products.
 */
export async function rankProducers(
  db: Db,
  opts: {
    profileId: string;
    producers: string[];
  },
): Promise<{
  buyerRank: Record<string, number>;
  globalRank: Record<string, number>;
}> {
  const buyerRank: Record<string, number> = {};
  const globalRank: Record<string, number> = {};
  if (!opts.producers.length) return { buyerRank, globalRank };

  const [{ data: myItems }, { data: allItems }] = await Promise.all([
    db
      .from("order_items")
      .select("quantity, product:products!inner(producer), orders!inner(profile_id)")
      .eq("orders.profile_id", opts.profileId)
      .in("product.producer", opts.producers),
    db
      .from("order_items")
      .select("quantity, product:products!inner(producer)")
      .in("product.producer", opts.producers),
  ]);

  type Row = { quantity: number; product: { producer: string | null } | null };
  for (const r of ((myItems ?? []) as unknown as Row[])) {
    const prod = r.product?.producer ?? undefined;
    if (!prod) continue;
    buyerRank[prod] = (buyerRank[prod] ?? 0) + Number(r.quantity ?? 0);
  }
  for (const r of ((allItems ?? []) as unknown as Row[])) {
    const prod = r.product?.producer ?? undefined;
    if (!prod) continue;
    globalRank[prod] = (globalRank[prod] ?? 0) + Number(r.quantity ?? 0);
  }
  return { buyerRank, globalRank };
}

/**
 * Sort comparator for producer names using the rank maps from rankProducers.
 * 1. Buyer's own frequency wins
 * 2. Tie-break by global popularity
 * 3. Final tie-break alphabetical
 */
export function compareProducersByRank(
  a: string,
  b: string,
  buyerRank: Record<string, number>,
  globalRank: Record<string, number>,
): number {
  const aMine = buyerRank[a] ?? 0;
  const bMine = buyerRank[b] ?? 0;
  if (aMine !== bMine) return bMine - aMine;
  const aGlobal = globalRank[a] ?? 0;
  const bGlobal = globalRank[b] ?? 0;
  if (aGlobal !== bGlobal) return bGlobal - aGlobal;
  return a.localeCompare(b);
}
