"use client";

import { useState } from "react";
import type { PackOption, Product } from "@/lib/supabase/types";
import { useCart } from "@/lib/cart/store";
import { useToast } from "@/components/ui/Toast";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { productPhoto } from "@/lib/utils/product-image";
import { displayProductName } from "@/lib/utils/product-display";
import { money } from "@/lib/utils/format";
import {
  ProducerEyebrow,
  ProductThumb,
  ProductStepper,
  PriceLine,
  haptic,
} from "@/components/products/primitives";

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
  // the product set changes mid-open.
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
  // totals.
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
      desktopMaxWidth="56rem"
    >
      <div className="flex flex-col h-full md:min-h-[400px] md:max-h-[80vh] md:h-[70vh]">
        <div className="px-5 pt-2 md:pt-5 pb-3">
          <h2 className="display text-xl font-bold tracking-tight leading-tight">
            Stock up on {subject}
          </h2>
          <p className="text-[13px] text-ink-secondary mt-1">
            One tap to add the assortment — adjust each line below.
          </p>
        </div>

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
                  sheetProducerHeader={subject}
                  onChangeQty={(n) => setRow(product.id, { qty: n })}
                  onChangeVariant={(key) => setRow(product.id, { variantKey: key })}
                />
              );
            })
          )}
        </ul>

        <div
          className="shrink-0 border-t border-black/[0.06] bg-white px-4 py-3 flex items-center gap-3"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 0.75rem)" }}
        >
          <div className="flex-1 min-w-0 leading-tight">
            <div className="text-[13px] text-ink-secondary tabular">
              {lineCount} {lineCount === 1 ? "line" : "lines"}
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
 * Single row. Thumbnail + producer eyebrow + name + price/size + optional
 * variant pills + qty stepper. Composed from the shared primitives —
 * matches ProductCard.row's identity treatment so the two read as
 * siblings.
 */
function StockUpRow({
  product,
  state,
  sheetProducerHeader,
  onChangeQty,
  onChangeVariant,
}: {
  product: PricedProduct;
  state: RowState;
  sheetProducerHeader: string;
  onChangeQty: (n: number) => void;
  onChangeVariant: (key: string | null) => void;
}) {
  // When the sheet was opened from a producer-filtered view, the heading
  // already says "Stock up on {producer}", so re-stating the producer on
  // every row is redundant. Skip the eyebrow only when they match.
  const sheetIsProducer =
    !!product.producer &&
    product.producer.trim().toLowerCase() ===
      sheetProducerHeader.trim().toLowerCase();
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

  const pricedOpts = opts.filter(
    (o) => (o.wholesale_price ?? o.retail_price ?? null) != null,
  );
  const showDefaultPill = product.unitPrice != null;
  const pillCount = (showDefaultPill ? 1 : 0) + pricedOpts.length;
  const hasVariants = pillCount > 1;
  const defaultPillLabel = product.pack_size ?? "Each";

  function bump(n: number) {
    if (n > state.qty) haptic(8);
    else if (n < state.qty) haptic(6);
    onChangeQty(Math.min(9999, Math.max(0, n)));
  }

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <ProductThumb product={product} photo={photo} sizePx={56} />

      <div className="flex-1 min-w-0">
        {product.producer && !sheetIsProducer ? (
          <ProducerEyebrow producer={product.producer} />
        ) : null}
        <div
          className="text-[14px] font-semibold leading-snug text-ink-primary mt-0.5 line-clamp-2"
          title={product.name}
        >
          {displayName}
        </div>
        <PriceLine
          price={activePrice}
          size={sizeLabel}
          weight="medium"
          textSize="xs"
          className="mt-0.5 truncate"
        />

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

      <div className="shrink-0 pt-0.5">
        <ProductStepper
          available
          cartQty={state.qty}
          onAdd={() => bump(state.qty + 1)}
          onSub={() => bump(state.qty - 1)}
          onSet={(n) => onChangeQty(Math.min(9999, Math.max(0, n)))}
          size="sm"
          ariaProductName={product.name}
          alwaysExpanded
        />
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

function defaultVariantKey(p: PricedProduct): string | null {
  if (p.unitPrice != null) return null;
  const opts = (p.pack_options as PackOption[] | null) ?? [];
  for (const o of opts) {
    if ((o.wholesale_price ?? o.retail_price ?? null) != null) return o.key;
  }
  return null;
}

function buildOpenKey(products: PricedProduct[]): string {
  return products.map((p) => p.id).join("|");
}
