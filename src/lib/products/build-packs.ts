import type { PackOption, Product } from "@/lib/supabase/types";
import type { PricingContext } from "@/lib/utils/pricing";
import { resolvePrice } from "@/lib/utils/pricing";
import {
  defaultPackRow,
  optionPackRow,
  type PackRow,
} from "@/app/(storefront)/catalog/[id]/packs";

/**
 * Build the priced pack list for a single product — its default pack plus
 * any pack_options — without doing any DB I/O. The PricingContext is
 * loaded once per catalog/guide page render (`loadPricingContext`), so
 * iterating it across N visible products is zero new queries.
 *
 * The resulting rows match the shape `loadGroupedPacks` returns for the
 * primary product, MINUS the sibling-grouped rows. The client-state
 * detail sheet uses these for instant-paint; if the product turns out to
 * be a sibling-grouped candidate (name contains " — Size"), the sheet
 * lazily fires `loadProductDetail` to fan out the rest of the group and
 * swaps in the union when it returns.
 *
 * Unpriced packs (no wholesale/retail/list/override) are skipped — same
 * behavior as `loadGroupedPacks`. A product that has no priced packs at
 * all returns an empty array; the sheet renders the "Contact your rep
 * for pricing" fallback in that case.
 */
export function buildSelfPacks(product: Product, ctx: PricingContext): PackRow[] {
  const customPrice = ctx.overrides.find((o) => o.product_id === product.id) ?? null;
  const priceListItem = ctx.listItems.find((it) => it.product_id === product.id) ?? null;

  const packs: PackRow[] = [];
  const defaultPrice = resolvePrice(product, {
    account: ctx.account,
    customPrice,
    priceListItem,
    isB2B: ctx.isB2B,
  });
  // Pre-computed packs aren't grouped — a sibling upgrade replaces this
  // entire list when it arrives. Pass null for groupedSuffix so the
  // default-pack row uses its natural unit+pack-size label.
  if (defaultPrice != null) packs.push(defaultPackRow(product, defaultPrice, null));

  const opts = (product.pack_options as PackOption[] | null) ?? [];
  for (const opt of opts) {
    const optPrice = resolvePrice(
      { wholesale_price: opt.wholesale_price, retail_price: opt.retail_price },
      {
        account: ctx.account,
        customPrice,
        priceListItem,
        isB2B: ctx.isB2B,
      },
    );
    if (optPrice != null) packs.push(optionPackRow(product, opt, optPrice, null));
  }
  return packs;
}

/**
 * True when the product's name carries a pack-size suffix
 * (" — Gallon", " · 6 oz", etc.), which means it likely belongs to a
 * sibling group. The detail sheet uses this to decide whether to fire
 * the lazy `loadProductDetail` action: most products don't have
 * siblings, so the action skips for them entirely.
 *
 * Mirrors the regex inside `baseNameForGrouping` so the two stay in
 * lockstep — em-dash, en-dash, or middot with surrounding whitespace.
 */
export function isGroupedCandidate(productName: string): boolean {
  return /\s+[—–·]\s+/.test(productName);
}
