import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { visibleProductsQuery } from "./queries";

/** Global cache tag. Admin product writes (create / update / delete) and
 *  account-allowlist edits call `revalidateTag(CATALOG_SUGGESTIONS_TAG, "max")`
 *  so the next page render rebuilds the suggestion list. */
export const CATALOG_SUGGESTIONS_TAG = "catalog-suggestions";

interface SuggestionScope {
  buyerType: string | null | undefined;
  isB2B: boolean;
  allowedPrivateIds?: string[];
}

/**
 * Returns the deduped product-name + producer-name list that powers
 * the `<datalist>` browser autocomplete on /catalog. Called twice per
 * catalog render (landing + list views both pass it to the search
 * input), so wrapping it in React.cache() dedupes within the request
 * and unstable_cache persists the result in Vercel's data cache
 * keyed by the buyer's visibility scope.
 *
 * The underlying query selects ~500-1000 product rows; running it on
 * every catalog navigation was a chunk of the per-page latency.
 */
export const getCatalogSuggestions = cache(
  async (scope: SuggestionScope): Promise<string[]> => {
    const allowedKey = (scope.allowedPrivateIds ?? []).slice().sort().join(",");
    const fetcher = unstable_cache(
      async () => {
        const db = createServiceClient();
        const { data } = await visibleProductsQuery(db, {
          buyerType: scope.buyerType,
          isB2B: scope.isB2B,
          allowedPrivateIds: scope.allowedPrivateIds,
          select: "name, producer",
        }).order("name", { ascending: true });
        const set = new Set<string>();
        for (const r of (data as { name: string | null; producer: string | null }[] | null) ?? []) {
          if (r.name) set.add(r.name);
          if (r.producer) set.add(r.producer);
        }
        return Array.from(set).slice(0, 500);
      },
      [
        "catalog-suggestions",
        scope.buyerType ?? "null",
        String(scope.isB2B),
        allowedKey,
      ],
      { tags: [CATALOG_SUGGESTIONS_TAG], revalidate: 3600 },
    );
    return fetcher();
  },
);
