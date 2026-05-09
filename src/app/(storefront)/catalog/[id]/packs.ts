import type {
  Account,
  AccountPricing,
  PackOption,
  PriceListItem,
  Product,
} from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolvePrice } from "@/lib/utils/pricing";
import { isProductVisibleToAccount } from "@/lib/products/queries";

type AnyDb = SupabaseClient<any, any, any>;

export interface PackRow {
  /** ID of the product this row belongs to. May differ from the page's
   * primary product when sibling products with the same base name (e.g.
   * Whole Milk — Gallon vs Whole Milk — Half Gallon) are grouped. */
  productId: string;
  /** Display name of the source product, used as the cart line label. */
  productName: string;
  /** null for the product's built-in default variant */
  variantKey: string | null;
  label: string;
  unit: string;
  packSize: string | null;
  sku: string | null;
  unitPrice: number;
  priceByWeight: boolean;
}

export function defaultPackRow(product: Product, unitPrice: number): PackRow {
  return {
    productId: product.id,
    productName: product.name,
    variantKey: null,
    label:
      titleCase(product.unit) + (product.pack_size ? ` — ${product.pack_size}` : ""),
    unit: product.unit,
    packSize: product.pack_size,
    sku: product.sku,
    unitPrice,
    priceByWeight: Boolean(product.price_by_weight),
  };
}

export function optionPackRow(product: Product, opt: PackOption, unitPrice: number): PackRow {
  return {
    productId: product.id,
    productName: product.name,
    variantKey: opt.key,
    label: opt.label,
    unit: opt.unit,
    packSize: opt.pack_size,
    sku: opt.sku ?? product.sku,
    unitPrice,
    priceByWeight: Boolean(product.price_by_weight),
  };
}

/**
 * Drop the trailing pack-size suffix from a product name to derive a stable
 * group key. Catalog convention writes sizes as " — Gallon", " – Pint",
 * " · 6 oz" — em-dash, en-dash, or middot with surrounding whitespace.
 * Plain hyphens are left alone so compound words like "X-Large Brown" stay
 * intact.
 *
 * Examples:
 *   "Ithaca Milk Whole — Gallon"      → "Ithaca Milk Whole"
 *   "Ithaca Milk Whole — Half Gallon" → "Ithaca Milk Whole"
 *   "X-Large Brown — Carton"          → "X-Large Brown"
 *   "Whole Milk"                       → "Whole Milk" (no change)
 */
export function baseNameForGrouping(name: string): string {
  const re = /\s+[—–·]\s+[^—–·]+\s*$/;
  return name.replace(re, "").trim() || name;
}

/**
 * Build the full pack list shown on the product detail card. Includes:
 *   1. The primary product's default pack + any pack_options.
 *   2. Sibling products that share the same producer + category + base name
 *      (after stripping the " — Size" suffix), with their default packs
 *      and pack_options.
 *
 * Sibling visibility is enforced — buyers only see channels and private SKUs
 * they're allowed to order. Pricing fans out from a single batched query.
 */
export async function loadGroupedPacks(
  db: AnyDb,
  product: Product,
  ctx: {
    account: Account | null;
    isB2B: boolean;
    impersonating: boolean;
  },
): Promise<{ packs: PackRow[]; products: Product[] }> {
  const baseName = baseNameForGrouping(product.name);
  const hasPotentialSiblings = baseName !== product.name;

  let candidateSiblings: Product[] = [];
  if (hasPotentialSiblings) {
    let q = db
      .from("products")
      .select("*")
      .eq("category", product.category)
      .eq("is_active", true)
      .neq("id", product.id)
      .ilike("name", `${baseName}%`);
    q = product.producer ? q.eq("producer", product.producer) : q.is("producer", null);
    const { data } = await q;
    candidateSiblings = ((data as Product[] | null) ?? []).filter(
      (s) => baseNameForGrouping(s.name) === baseName,
    );
  }

  // Visibility filter — buyers only see siblings on their channel + allow-list.
  const channelKey = ctx.isB2B ? "available_b2b" : "available_dtc";
  const visibleSiblings: Product[] = [];
  for (const s of candidateSiblings) {
    if (!ctx.impersonating) {
      if (!s[channelKey]) continue;
      const visOk = await isProductVisibleToAccount(db, s, ctx.account?.id ?? null);
      if (!visOk) continue;
    }
    visibleSiblings.push(s);
  }

  const sortedSiblings = visibleSiblings
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name));
  const groupedProducts: Product[] = [product, ...sortedSiblings];

  // Batch-load account pricing inputs for the whole group so we don't fan
  // out N×2 queries for what's typically a 2-4 product group.
  const productIds = groupedProducts.map((p) => p.id);
  const [overridesRes, listItemsRes] = await Promise.all([
    ctx.account
      ? db
          .from("account_pricing")
          .select("*")
          .eq("account_id", ctx.account.id)
          .in("product_id", productIds)
      : Promise.resolve({ data: [] as AccountPricing[] }),
    ctx.account?.price_list_id
      ? db
          .from("price_list_items")
          .select("*")
          .eq("price_list_id", ctx.account.price_list_id)
          .in("product_id", productIds)
      : Promise.resolve({ data: [] as PriceListItem[] }),
  ]);
  const overrides = (overridesRes.data as AccountPricing[] | null) ?? [];
  const listItems = (listItemsRes.data as PriceListItem[] | null) ?? [];

  const packs: PackRow[] = [];
  for (const p of groupedProducts) {
    const customPrice = overrides.find((o) => o.product_id === p.id) ?? null;
    const priceListItem = listItems.find((li) => li.product_id === p.id) ?? null;
    const defaultPrice = resolvePrice(p, {
      account: ctx.account,
      customPrice,
      priceListItem,
      isB2B: ctx.isB2B,
    });
    if (defaultPrice != null) packs.push(defaultPackRow(p, defaultPrice));
    const opts = (p.pack_options as PackOption[] | null) ?? [];
    for (const opt of opts) {
      const optPrice = resolvePrice(
        { wholesale_price: opt.wholesale_price, retail_price: opt.retail_price },
        { account: ctx.account, customPrice, priceListItem, isB2B: ctx.isB2B },
      );
      if (optPrice != null) packs.push(optionPackRow(p, opt, optPrice));
    }
  }
  return { packs, products: groupedProducts };
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
