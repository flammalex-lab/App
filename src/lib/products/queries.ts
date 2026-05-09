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
 * Pre-fetch the IDs of private products this account is allow-listed for.
 * Pass the result to visibleProductsQuery via `allowedPrivateIds`. Returns
 * [] for null accounts (DTC, prospect-without-account, etc.) — those callers
 * see only public products.
 */
export async function getAllowedPrivateProductIds(
  db: AnyDb,
  accountId: string | null | undefined,
): Promise<string[]> {
  if (!accountId) return [];
  const { data } = await db
    .from("account_products")
    .select("product_id")
    .eq("account_id", accountId);
  return ((data as { product_id: string }[] | null) ?? []).map((r) => r.product_id);
}

/**
 * Single-product visibility check — used by routes that fetch one product
 * directly (product detail page, scan endpoint) and need to reject private
 * SKUs the account isn't allow-listed for. Public products are always visible.
 *
 * RLS already enforces this for non-impersonating buyers, but admin sessions
 * use the service client (bypasses RLS), so the gate has to be repeated in
 * code there too.
 */
export async function isProductVisibleToAccount(
  db: AnyDb,
  product: { id: string; private: boolean },
  accountId: string | null | undefined,
): Promise<boolean> {
  if (!product.private) return true;
  if (!accountId) return false;
  const { data } = await db
    .from("account_products")
    .select("product_id")
    .eq("account_id", accountId)
    .eq("product_id", product.id)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Base catalog query for buyer-facing reads. Callers chain further filters,
 * order, and limit, then await. Guarantees:
 *   - is_active = true
 *   - channel availability flag set for the buyer (b2b vs dtc)
 *   - product_group/category scoped to the buyer's buyer_type
 *   - private products are hidden unless the buyer's account is allow-listed
 *     (pass `allowedPrivateIds` from getAllowedPrivateProductIds())
 *
 * Use anywhere a buyer browses the catalog, guide, standing orders, scan,
 * or detail page. Admin picker code should use adminPickerProductsQuery
 * instead so unlaunched products can still be curated.
 */
export function visibleProductsQuery(
  db: AnyDb,
  opts: {
    buyerType: string | null | undefined;
    isB2B: boolean;
    allowedPrivateIds?: string[];
    select?: string;
  },
): any {
  let q: any = db.from("products").select(opts.select ?? "*").eq("is_active", true);
  q = q.eq(opts.isB2B ? "available_b2b" : "available_dtc", true);

  // Privacy gate. With no allow-list, hide all private SKUs; with an allow
  // list, show non-private OR explicitly-allowed products.
  const ids = opts.allowedPrivateIds ?? [];
  if (ids.length === 0) {
    q = q.eq("private", false);
  } else {
    q = q.or(`private.eq.false,id.in.(${ids.join(",")})`);
  }

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
 * Admin queries always see private products — curating allow-lists requires it.
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
