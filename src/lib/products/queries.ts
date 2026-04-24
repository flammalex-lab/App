import type { SupabaseClient } from "@supabase/supabase-js";
import { allowedCategoriesFor, allowedGroupsFor } from "@/lib/constants";

type AnyDb = SupabaseClient<any, any, any>;

/**
 * Shared scoping expression for "which products does this buyer_type see."
 * Matches EITHER product_group (canonical, new) OR category (legacy fallback
 * for rows that predate migration 0006). Every live query should use this so
 * the visibility rules can't drift per-page.
 */
function buyerScopeOrExpr(buyerType: string | null | undefined): string | null {
  const allowedGroups = allowedGroupsFor(buyerType);
  const allowedCats = allowedCategoriesFor(buyerType);
  const parts: string[] = [];
  if (allowedGroups.length) parts.push(`product_group.in.(${allowedGroups.join(",")})`);
  if (allowedCats.length) parts.push(`category.in.(${allowedCats.join(",")})`);
  return parts.length ? parts.join(",") : null;
}

/**
 * Base catalog query for buyer-facing reads. Callers chain further filters,
 * order, and limit, then await. Guarantees:
 *   - is_active = true
 *   - channel availability flag set for the buyer (b2b vs dtc)
 *   - product_group/category scoped to the buyer's buyer_type
 *
 * Use anywhere a buyer browses the catalog, guide, standing orders, scan,
 * or detail page. Admin picker code should use adminPickerProductsQuery
 * instead so unlaunched products can still be curated.
 */
export function visibleProductsQuery(
  db: AnyDb,
  opts: { buyerType: string | null | undefined; isB2B: boolean; select?: string },
) {
  let q = db.from("products").select(opts.select ?? "*").eq("is_active", true);
  q = q.eq(opts.isB2B ? "available_b2b" : "available_dtc", true);
  const orExpr = buyerScopeOrExpr(opts.buyerType);
  if (orExpr) q = q.or(orExpr);
  return q;
}

/**
 * Admin picker base query — same group/category scoping as the buyer view
 * but keeps `available_b2b=false` rows visible by default so admins can
 * curate templates and guides before go-live. Unavailable rows should be
 * surfaced with a "Not live" badge in the UI (see callers).
 *
 * Pass onlyAvailableB2B=true to enforce parity with what the buyer sees.
 */
export function adminPickerProductsQuery(
  db: AnyDb,
  opts: {
    buyerType: string | null | undefined;
    onlyAvailableB2B?: boolean;
    select?: string;
  },
) {
  let q = db.from("products").select(opts.select ?? "*").eq("is_active", true);
  if (opts.onlyAvailableB2B) q = q.eq("available_b2b", true);
  const orExpr = buyerScopeOrExpr(opts.buyerType);
  if (orExpr) q = q.or(orExpr);
  return q;
}
