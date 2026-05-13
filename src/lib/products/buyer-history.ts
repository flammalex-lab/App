import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type AnyDb = SupabaseClient<any, any, any>;

export interface BuyerHistoryRow {
  product_id: string;
  quantity: number;
  producer: string | null;
  orderedAt: string | null;
}

/**
 * Single source of truth for "what has THIS buyer ordered, ever?". Pages
 * that previously fetched the same `order_items` slice three different
 * ways (last-ordered lookup, producer-frequency rank, new-from-producers
 * discovery) now derive all three from one query — and react `cache()`
 * dedupes it across calls inside the same request so the SQL only runs
 * once even if multiple helpers ask for it.
 *
 * Note: `cache()` is per-request only; it does not persist across
 * navigations. To extend the lifetime across requests, wrap the
 * call site in `unstable_cache` with a tag instead.
 */
export const getBuyerHistory = cache(
  async (db: AnyDb, profileId: string): Promise<BuyerHistoryRow[]> => {
    const { data } = await db
      .from("order_items")
      .select(
        "product_id, quantity, product:products!inner(producer), orders!inner(profile_id, created_at)",
      )
      .eq("orders.profile_id", profileId);
    return ((data as any[] | null) ?? []).map((r) => ({
      product_id: r.product_id as string,
      quantity: Number(r.quantity ?? 0),
      producer: (r.product?.producer ?? null) as string | null,
      orderedAt: (r.orders?.created_at ?? null) as string | null,
    }));
  },
);
