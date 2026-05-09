import type {
  Account,
  AccountPricing,
  PriceListItem,
  Product,
} from "@/lib/supabase/types";
import { TIER_MULTIPLIERS } from "@/lib/constants";
import type { SupabaseClient } from "@supabase/supabase-js";

type AnyDb = SupabaseClient<any, any, any>;

/**
 * Resolve the unit price a given account (or DTC customer) pays for a product.
 *
 * Priority:
 *   1. Account-specific custom price (account_pricing) — most-specific override
 *   2. Price-list price (price_list_items for account.price_list_id) — shared
 *      contract sheet across N accounts (e.g. "Hospitality 2026")
 *   3. wholesale_price × tier multiplier (B2B)
 *   4. retail_price (DTC)
 *
 * Returns null if nothing is priced (admin must set a price before ordering).
 */
export function resolvePrice(
  product: Pick<Product, "wholesale_price" | "retail_price">,
  options: {
    account?: Pick<Account, "pricing_tier"> | null;
    customPrice?: Pick<AccountPricing, "custom_price" | "effective_date" | "expiry_date"> | null;
    priceListItem?: Pick<PriceListItem, "unit_price" | "effective_date" | "expiry_date"> | null;
    isB2B: boolean;
    now?: Date;
  },
): number | null {
  const { account, customPrice, priceListItem, isB2B } = options;
  const now = options.now ?? new Date();

  if (customPrice && isWindowOpen(customPrice.effective_date, customPrice.expiry_date, now)) {
    return Number(customPrice.custom_price);
  }

  if (priceListItem && isWindowOpen(priceListItem.effective_date, priceListItem.expiry_date, now)) {
    return Number(priceListItem.unit_price);
  }

  if (isB2B) {
    if (product.wholesale_price == null) return null;
    const tier = account?.pricing_tier ?? "standard";
    return round2(Number(product.wholesale_price) * TIER_MULTIPLIERS[tier]);
  }

  return product.retail_price == null ? null : Number(product.retail_price);
}

/**
 * Pre-fetched pricing inputs for an account. Loaded once per page render so
 * resolving N products doesn't fan out to N×2 queries.
 */
export interface PricingContext {
  account: Account | null;
  isB2B: boolean;
  overrides: AccountPricing[];
  listItems: PriceListItem[];
}

/**
 * Load both account_pricing overrides and the assigned price-list items in
 * parallel. Use at the top of catalog/guide pages, then call priceForProduct
 * per product row.
 */
export async function loadPricingContext(
  db: AnyDb,
  account: Account | null,
  isB2B: boolean,
): Promise<PricingContext> {
  if (!account) return { account, isB2B, overrides: [], listItems: [] };

  const [overridesRes, listItemsRes] = await Promise.all([
    db.from("account_pricing").select("*").eq("account_id", account.id),
    account.price_list_id
      ? db.from("price_list_items").select("*").eq("price_list_id", account.price_list_id)
      : Promise.resolve({ data: [] as PriceListItem[] }),
  ]);

  return {
    account,
    isB2B,
    overrides: (overridesRes.data as AccountPricing[] | null) ?? [],
    listItems: (listItemsRes.data as PriceListItem[] | null) ?? [],
  };
}

/**
 * Convenience wrapper: pull the matching override + price-list row out of the
 * pre-loaded context and run resolvePrice. Returns null when nothing applies.
 */
export function priceForProduct(
  product: Pick<Product, "id" | "wholesale_price" | "retail_price">,
  ctx: PricingContext,
): number | null {
  const customPrice = ctx.overrides.find((o) => o.product_id === product.id) ?? null;
  const priceListItem = ctx.listItems.find((it) => it.product_id === product.id) ?? null;
  return resolvePrice(product, {
    account: ctx.account,
    customPrice,
    priceListItem,
    isB2B: ctx.isB2B,
  });
}

function isWindowOpen(
  effective: string,
  expiry: string | null | undefined,
  now: Date,
): boolean {
  const eff = new Date(effective);
  if (eff > now) return false;
  if (expiry && new Date(expiry) < now) return false;
  return true;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
