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

export function defaultPackRow(
  product: Product,
  unitPrice: number,
  groupedSuffix?: string | null,
): PackRow {
  return {
    productId: product.id,
    productName: product.name,
    variantKey: null,
    label: groupedSuffix
      ? groupedSuffix
      : titleCase(product.unit) + (product.pack_size ? ` — ${product.pack_size}` : ""),
    unit: product.unit,
    packSize: product.pack_size,
    sku: product.sku,
    unitPrice,
    priceByWeight: Boolean(product.price_by_weight),
  };
}

export function optionPackRow(
  product: Product,
  opt: PackOption,
  unitPrice: number,
  groupedSuffix?: string | null,
): PackRow {
  return {
    productId: product.id,
    productName: product.name,
    variantKey: opt.key,
    // Prepend the grouped suffix so a pack option keeps its sibling context
    // ("Gallon — Single" vs just "Single", which would collide with Half
    // Gallon's "Single").
    label: groupedSuffix ? `${groupedSuffix} — ${opt.label}` : opt.label,
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
 * Inverse of baseNameForGrouping — returns just the trailing pack-size phrase
 * ("Gallon", "Half Gallon", "Carton") so a sibling row can label itself with
 * what actually distinguishes it. Returns null when the name has no
 * recognized suffix to extract.
 */
export function packSuffixFromName(name: string): string | null {
  const m = name.match(/\s+[—–·]\s+([^—–·]+)\s*$/);
  return m ? m[1].trim() || null : null;
}

/**
 * Title shown on a grouped detail card — strips both the pack-size suffix
 * and the producer prefix. Mirrors the small-card title pattern so a buyer
 * sees "Whole" instead of "Ithaca Milk Whole" right under a producer chip
 * that already says "Find more from Ithaca Milk". Falls back to the original
 * name if everything would get stripped.
 */
export function groupedDetailTitle(name: string, producer: string | null | undefined): string {
  let n = baseNameForGrouping(name);
  if (producer) {
    const p = producer.trim();
    if (p && n.toLowerCase().startsWith(p.toLowerCase() + " ")) {
      n = n.slice(p.length).trim();
    }
  }
  return n || name;
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

  // Sort the entire group together — we want sizes in a consistent order
  // (Gallon → Half Gallon → Quart) regardless of which sibling the buyer
  // entered through, otherwise clicking the smallest size scrambles the list.
  const groupedProducts: Product[] = [product, ...visibleSiblings].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name),
  );
  const isGrouped = groupedProducts.length > 1;

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
    // Use the name-suffix ("Gallon", "Half Gallon", …) as the row label when
    // grouped — that's the part the title strips off, and it's what actually
    // distinguishes one sibling from the next. Falls back to the default
    // unit/pack_size label if the name has no recognized suffix.
    const groupedSuffix = isGrouped ? packSuffixFromName(p.name) : null;
    const defaultPrice = resolvePrice(p, {
      account: ctx.account,
      customPrice,
      priceListItem,
      isB2B: ctx.isB2B,
    });
    if (defaultPrice != null) packs.push(defaultPackRow(p, defaultPrice, groupedSuffix));
    const opts = (p.pack_options as PackOption[] | null) ?? [];
    for (const opt of opts) {
      const optPrice = resolvePrice(
        { wholesale_price: opt.wholesale_price, retail_price: opt.retail_price },
        { account: ctx.account, customPrice, priceListItem, isB2B: ctx.isB2B },
      );
      if (optPrice != null) packs.push(optionPackRow(p, opt, optPrice, groupedSuffix));
    }
  }
  return { packs, products: groupedProducts };
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
