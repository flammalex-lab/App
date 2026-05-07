import type { Account, AccountPricing, Product } from "@/lib/supabase/types";
import { TIER_MULTIPLIERS } from "@/lib/constants";

/**
 * Resolve the unit price a given account (or DTC customer) pays for a product.
 *
 * Priority:
 *   1. Account-specific custom price (account_pricing)
 *   2. wholesale_price × tier multiplier (B2B)
 *   3. retail_price (DTC)
 *
 * Returns null if nothing is priced (admin must set a price before ordering).
 */
export function resolvePrice(
  product: Pick<Product, "wholesale_price" | "retail_price">,
  options: {
    account?: Pick<Account, "pricing_tier"> | null;
    customPrice?: Pick<AccountPricing, "custom_price" | "effective_date" | "expiry_date"> | null;
    isB2B: boolean;
    now?: Date;
  },
): number | null {
  const { account, customPrice, isB2B } = options;
  const now = options.now ?? new Date();

  if (customPrice) {
    const effective = new Date(customPrice.effective_date);
    const expiry = customPrice.expiry_date ? new Date(customPrice.expiry_date) : null;
    if (effective <= now && (!expiry || now <= expiry)) {
      return Number(customPrice.custom_price);
    }
  }

  if (isB2B) {
    if (product.wholesale_price == null) return null;
    const tier = account?.pricing_tier ?? "standard";
    return round2(Number(product.wholesale_price) * TIER_MULTIPLIERS[tier]);
  }

  return product.retail_price == null ? null : Number(product.retail_price);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
