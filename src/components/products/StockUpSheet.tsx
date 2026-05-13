"use client";

import { useState } from "react";
import Image from "next/image";
import type { PackOption, Product } from "@/lib/supabase/types";
import { useCart } from "@/lib/cart/store";
import { useToast } from "@/components/ui/Toast";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { QtyInput } from "@/components/ui/QtyInput";
import { ProductCardFallback } from "@/components/products/ProductCardFallback";
import { productPhoto } from "@/lib/utils/product-image";
import { displayProductName } from "@/lib/utils/product-display";
import { money } from "@/lib/utils/format";

type PricedProduct = Product & { unitPrice: number | null };

/**
 * One row state slot. variantKey = null means "default pack" (the
 * product.unit / product.unitPrice). Non-null keys point at an entry in
 * product.pack_options. Mirrors how VariantPickerSheet resolves variants.
 */
interface RowState {
  qty: number;
  variantKey: string | null;
}

/**
 * Stock-up sheet: opens from a producer- or sub-category-filtered catalog
 * and lets a buyer dial in qty + size for every product in that subject's
 * assortment in one pass, then commits all rows to cart with a single tap.
 * Saves the chef the 16-tap drill of going PDP-by-PDP through a long list.
 *
 * `subject` is the noun used in the heading ("Stock up on {subject}") —
 * a producer name on producer pages, a sub-category name (e.g. "Milk")
 * on category drill-downs from the order guide.
 *
 * One row per product (not per SKU). Products with multiple pack options
 * get a size-pill toggle; the stepper applies to whichever pill is active.
 *
 * Unavailable products (paused, week-off, or unpriced) are filtered out —
 * the buyer can't act on them from here, so they'd just be noise.
 */
export function StockUpSheet({
  open,
  onClose,
  subject,
  products,
}: {
  open: boolean;
  onClose: () => void;
  subject: string;
  products: PricedProduct[];
}) {
  const add = useCart((s) => s.add);
  const toast = useToast();

  // Filter to orderable rows first so row-keyed state matches the rendered list.
  const orderable = products.filter(isOrderable);

  // Build the initial row state once per open. Default qty = 1 per the
  // brief (buyer is in "one of each" mode), default variantKey = null
  // (the product's own pack).
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    buildInitialRows(orderable),
  );

  // Resync rows whenever the sheet transitions from closed→open, or when
  // the product set changes mid-open. Render-time sync mirrors how
  // BottomSheet handles its own open transition (no effect cascade).
  // Closing also resets so a re-open isn't haunted by leftover qty=0 rows.
  const openKey = open ? buildOpenKey(orderable) : "__closed__";
  const [lastOpenKey, setLastOpenKey] = useState<string>(openKey);
  if (openKey !== lastOpenKey) {
    setLastOpenKey(openKey);
    if (open) setRows(buildInitialRows(orderable));
  }

  function setRow(productId: string, next: Partial<RowState>) {
    setRows((prev) => ({
      ...prev,
      [productId]: { ...(prev[productId] ?? { qty: 1, variantKey: null }), ...next },
    }));
  }

  function resolveRow(product: PricedProduct, state: RowState): {
    unitPrice: number | null;
    unit: string;
    packSize: string | null;
    variantSku: string | null;
    variantLabel: string | null;
    priceByWeight: boolean;
  } {
    const opts = (product.pack_options as PackOption[] | null) ?? [];
    if (state.variantKey != null) {
      const opt = opts.find((o) => o.key === state.variantKey);
      if (opt) {
        const price = opt.wholesale_price ?? opt.retail_price ?? null;
        return {
          unitPrice: price,
          unit: opt.unit,
          packSize: opt.pack_size,
          variantSku: opt.sku,
          variantLabel: opt.label,
          priceByWeight: false,
        };
      }
    }
    return {
      unitPrice: product.unitPrice,
      unit: product.unit,
      packSize: product.pack_size,
      variantSku: null,
      variantLabel: null,
      priceByWeight: Boolean(product.price_by_weight),
    };
  }

  // Footer math — only rows with qty > 0 count toward the line + subtotal
  // totals. Missing state falls back to the same default as the rendering
  // (qty 1, default pack) so the footer can't disagree with what the
  // buyer sees in a row. Unpriced variants count as 0 even if qty>0 so
  // the buyer never sees a falsely-low subtotal.
  let lineCount = 0;
  let subtotal = 0;
  for (const p of orderable) {
    const state = rows[p.id] ?? { qty: 1, variantKey: null };
    if (state.qty <= 0) continue;
    const resolved = resolveRow(p, state);
    if (resolved.unitPrice == null) continue;
    lineCount += 1;
    subtotal += resolved.unitPrice * state.qty;
  }

  function handleAdd() {
    let added = 0;
    for (const p of orderable) {
      const state = rows[p.id] ?? { qty: 1, variantKey: null };
      if (state.qty <= 0) continue;
      const resolved = resolveRow(p, state);
      if (resolved.unitPrice == null) continue;
      add({
        productId: p.id,
        variantKey: state.variantKey,
        variantSku: resolved.variantSku,
        variantLabel: resolved.variantLabel,
        sku: p.sku,
        name: p.name,
        packSize: resolved.packSize,
        unit: resolved.unit,
        unitPrice: resolved.unitPrice,
        priceByWeight: resolved.priceByWeight,
        quantity: state.qty,
      });
      added += 1;
    }
    if (added > 0) {
      haptic(10);
      toast.push(`Added ${added} ${added === 1 ? "item" : "items"} to cart.`, "info");
    }
    onClose();
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      ariaLabel={`Stock up on ${subject}`}
      desktopMaxWidth="36rem"
    >
      <div className="flex flex-col h-full">
        {/* Header — display font, no border-bottom (we get one from the
            list's top edge instead). Subtitle uses the editorial voice
            from docs/design-system.md: terse, no "successfully", no
            exclamation. */}
        <div className="px-5 pt-2 md:pt-5 pb-3">
          <h2 className="display text-xl font-bold tracking-tight leading-tight">
            Stock up on {subject}
          </h2>
          <p className="text-[13px] text-ink-secondary mt-1">
            One tap to add the assortment — adjust each line below.
          </p>
        </div>

        {/* Scrollable list. flex-1 + min-h-0 so it shrinks inside the
            sheet's height-managed flex column without pushing the footer
            off-screen. */}
        <ul className="flex-1 min-h-0 overflow-y-auto overscroll-contain border-t border-black/[0.06] divide-y divide-black/[0.06]">
          {orderable.length === 0 ? (
            <li className="px-5 py-10 text-center text-sm text-ink-secondary">
              Nothing from {subject} is orderable this week.
            </li>
          ) : (
            orderable.map((product) => {
              const state = rows[product.id] ?? { qty: 1, variantKey: null };
              return (
                <StockUpRow
                  key={product.id}
                  product={product}
                  state={state}
                  onChangeQty={(n) => setRow(product.id, { qty: n })}
                  onChangeVariant={(key) => setRow(product.id, { variantKey: key })}
                />
              );
            })
          )}
        </ul>

        {/* Sticky footer — kept inside the sheet so it rides up with the
            sheet's height. Brand-blue CTA (no green; green is for Place
            order only per the design system). */}
        <div
          className="shrink-0 border-t border-black/[0.06] bg-white px-4 py-3 flex items-center gap-3"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 0.75rem)" }}
        >
          <div className="flex-1 min-w-0 leading-tight">
            <div className="text-[13px] text-ink-secondary tabular">
              {lineCount} {lineCount === 1 ? "item" : "items"}
              <span className="text-ink-tertiary"> · </span>
              <span className="text-ink-primary font-semibold">{money(subtotal)}</span>
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={lineCount === 0}
            className="h-11 px-5 inline-flex items-center justify-center rounded-full bg-brand-blue text-white text-[14px] font-semibold hover:bg-brand-blue-dark focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
          >
            Add to cart
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

/**
 * Single row. Thumbnail + name + size eyebrow + (optional variant pills) +
 * qty stepper. Matches the row aesthetic of ProductCard's row variant
 * without modifying it.
 */
function StockUpRow({
  product,
  state,
  onChangeQty,
  onChangeVariant,
}: {
  product: PricedProduct;
  state: RowState;
  onChangeQty: (n: number) => void;
  onChangeVariant: (key: string | null) => void;
}) {
  const photo = productPhoto(product);
  const opts = (product.pack_options as PackOption[] | null) ?? [];
  const displayName = displayProductName(
    product.name,
    product.producer,
    product.pack_size,
    product.case_pack,
  );

  // Resolve the active variant's price + size for the eyebrow line.
  let activePrice: number | null;
  let activeSize: string | null;
  let activeUnit: string;
  if (state.variantKey != null) {
    const opt = opts.find((o) => o.key === state.variantKey);
    activePrice = opt?.wholesale_price ?? opt?.retail_price ?? null;
    activeSize = opt?.pack_size ?? null;
    activeUnit = opt?.unit ?? product.unit;
  } else {
    activePrice = product.unitPrice;
    activeSize = product.case_pack ?? product.pack_size ?? null;
    activeUnit = product.unit;
  }
  const sizeLabel = activeSize ?? activeUnit;
  const priceLabel = activePrice != null ? money(activePrice) : "—";

  // Variant pill rows: "default" pill first (only when the default pack
  // is actually priced — otherwise it'd lead to an "—" row that can't be
  // added), then each priced pack_option. Buyer toggles which one the
  // stepper controls. Active = brand-blue solid; inactive = bordered.
  // A row with only one priced option doesn't need pills at all.
  const pricedOpts = opts.filter(
    (o) => (o.wholesale_price ?? o.retail_price ?? null) != null,
  );
  const showDefaultPill = product.unitPrice != null;
  const pillCount = (showDefaultPill ? 1 : 0) + pricedOpts.length;
  const hasVariants = pillCount > 1;
  const defaultPillLabel = product.pack_size ?? "Each";

  function qtyInc() {
    haptic(8);
    onChangeQty(Math.min(9999, state.qty + 1));
  }
  function qtyDec() {
    if (state.qty <= 0) return;
    haptic(6);
    onChangeQty(Math.max(0, state.qty - 1));
  }

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="relative h-14 w-14 shrink-0 rounded-md overflow-hidden bg-bg-secondary flex items-center justify-center">
        {photo ? (
          <Image
            src={photo}
            alt=""
            fill
            sizes="56px"
            className="object-contain mix-blend-multiply"
          />
        ) : (
          <ProductCardFallback product={product} size="sm" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        {product.producer ? (
          <div className="text-[10px] uppercase tracking-[0.08em] font-semibold text-ink-tertiary truncate leading-tight">
            {product.producer}
          </div>
        ) : null}
        <div
          className="text-[14px] font-semibold leading-snug text-ink-primary mt-0.5 line-clamp-2"
          title={product.name}
        >
          {displayName}
        </div>
        <div className="text-[12px] text-ink-secondary tabular mt-0.5 truncate">
          <span className="font-medium text-ink-primary">{priceLabel}</span>
          <span className="text-ink-tertiary"> · {sizeLabel}</span>
        </div>

        {hasVariants ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {showDefaultPill ? (
              <VariantPill
                active={state.variantKey == null}
                onClick={() => onChangeVariant(null)}
                label={defaultPillLabel}
              />
            ) : null}
            {pricedOpts.map((opt) => (
              <VariantPill
                key={opt.key}
                active={state.variantKey === opt.key}
                onClick={() => onChangeVariant(opt.key)}
                label={opt.label}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="shrink-0 flex items-center gap-1.5 pt-0.5">
        <button
          onClick={qtyDec}
          disabled={state.qty <= 0}
          aria-label="Decrease"
          className="h-9 w-9 flex items-center justify-center rounded-full border-2 border-brand-blue text-brand-blue hover:bg-brand-blue-tint focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors duration-150 active:scale-[0.97] disabled:opacity-30 disabled:pointer-events-none"
        >
          <span className="text-lg leading-none">−</span>
        </button>
        <QtyInput
          value={state.qty}
          onSet={(n) => onChangeQty(n)}
          ariaLabel={`${product.name} quantity`}
          className="h-9 w-11 text-center tabular text-[14px] font-semibold rounded-md border border-black/15 bg-white text-ink-primary focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30 transition-colors duration-150"
        />
        <button
          onClick={qtyInc}
          aria-label="Add one"
          className="h-9 w-9 flex items-center justify-center rounded-full bg-brand-blue text-white hover:bg-brand-blue-dark focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors duration-150 active:scale-[0.97]"
        >
          <span className="text-lg leading-none">+</span>
        </button>
      </div>
    </li>
  );
}

function VariantPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "h-8 px-3 rounded-full text-[12px] font-semibold bg-brand-blue text-white border border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors duration-150"
          : "h-8 px-3 rounded-full text-[12px] font-semibold bg-white text-ink-primary border border-black/15 hover:border-brand-blue/50 hover:text-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors duration-150"
      }
    >
      {label}
    </button>
  );
}

function isOrderable(p: PricedProduct): boolean {
  if (p.available_b2b === false) return false;
  if (p.available_this_week === false) return false;
  // No resolvable price for the default pack AND no priced pack_options
  // means there's nothing to buy at any size — hide the row.
  if (p.unitPrice == null) {
    const opts = (p.pack_options as PackOption[] | null) ?? [];
    const anyPriced = opts.some(
      (o) => (o.wholesale_price ?? o.retail_price ?? null) != null,
    );
    if (!anyPriced) return false;
  }
  return true;
}

function buildInitialRows(products: PricedProduct[]): Record<string, RowState> {
  const out: Record<string, RowState> = {};
  for (const p of products) {
    out[p.id] = { qty: 1, variantKey: defaultVariantKey(p) };
  }
  return out;
}

/**
 * Pick the initial variant for a product row. Prefer the default pack
 * when it's priced; otherwise fall back to the first priced pack_option.
 * Returning null means "use the default pack" (the product's own
 * unitPrice / unit). The buyer can always switch via the pills.
 */
function defaultVariantKey(p: PricedProduct): string | null {
  if (p.unitPrice != null) return null;
  const opts = (p.pack_options as PackOption[] | null) ?? [];
  for (const o of opts) {
    if ((o.wholesale_price ?? o.retail_price ?? null) != null) return o.key;
  }
  return null;
}

/** Stable key for the set of products in the sheet. Changes when the
 *  caller passes a different list, triggering a state reset. */
function buildOpenKey(products: PricedProduct[]): string {
  return products.map((p) => p.id).join("|");
}

function haptic(ms: number) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      (navigator as Navigator & { vibrate: (p: number | number[]) => boolean }).vibrate(ms);
    } catch {
      /* ignore */
    }
  }
}
