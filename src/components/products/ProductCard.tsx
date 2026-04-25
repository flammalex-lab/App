"use client";

import { useState } from "react";
import Link from "next/link";
import type { PackOption, Product } from "@/lib/supabase/types";
import { useCart } from "@/lib/cart/store";
import { productImage } from "@/lib/utils/product-image";
import { displayProductName } from "@/lib/utils/product-display";
import { money } from "@/lib/utils/format";
import { QtyInput } from "@/components/ui/QtyInput";
import { VariantPickerSheet } from "@/components/products/VariantPickerSheet";

export type PricedProduct = Product & { unitPrice: number | null };

type Variant = "grid" | "compact" | "row";

/**
 * Single canonical product card. Three visual variants share all cart +
 * availability logic; they differ only in layout.
 *
 *   - grid:    flat tile in a column grid (catalog grid view)
 *   - compact: vertical card for horizontal scroll strips
 *              (image-on-top, info+stepper below)
 *   - row:     full-width list row (producer-grouped category view)
 *
 * Stepper sized at 48dp / 48 CSS px — meets Material 3 (48) and exceeds
 * iOS HIG (44). Full-width pill on cards so the hit target is generous
 * without dominating the card frame; right-edge pill on rows.
 */
export function ProductCard({
  product,
  variant,
  fromGroup,
}: {
  product: PricedProduct;
  variant: Variant;
  fromGroup?: string | null;
}) {
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  // Sum across every variant of this product so the card reflects total
  // quantity, not just the default pack. For a buyer who picked 3 cases
  // and 2 singles via the variant sheet, the card should say "5".
  const cartQtyTotal = useCart((s) =>
    s.lines
      .filter((l) => l.productId === product.id)
      .reduce((sum, l) => sum + l.quantity, 0),
  );
  const cartQtyDefault = useCart(
    (s) =>
      s.lines.find((l) => l.productId === product.id && l.variantKey === null)?.quantity ?? 0,
  );
  const cartQty = cartQtyTotal;
  const paused = product.available_b2b === false;
  const available = product.available_this_week && product.unitPrice != null && !paused;
  const packOptions = (product.pack_options as PackOption[] | null) ?? [];
  const hasVariants = packOptions.length > 0;

  const [variantOpen, setVariantOpen] = useState(false);

  const detailHref = fromGroup
    ? `/catalog/${product.id}?from=${fromGroup}`
    : `/catalog/${product.id}`;
  const producerHref = product.producer
    ? `/catalog?producer=${encodeURIComponent(product.producer)}`
    : null;

  function addOne(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!available) return;
    // Multi-variant products → open the picker instead of silently +1ing
    // the default pack (which is rarely what the buyer wants when they
    // could be buying by the case).
    if (hasVariants) {
      setVariantOpen(true);
      return;
    }
    haptic(8);
    add({
      productId: product.id,
      variantKey: null,
      variantSku: null,
      sku: product.sku,
      name: product.name,
      packSize: product.pack_size,
      unit: product.unit,
      unitPrice: product.unitPrice!,
      priceByWeight: Boolean(product.price_by_weight),
      quantity: 1,
    });
  }
  function sub(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (hasVariants) {
      setVariantOpen(true);
      return;
    }
    haptic(6);
    setQty(product.id, Math.max(0, cartQtyDefault - 1), null);
  }
  function applyDirectQty(n: number) {
    if (n === 0) {
      setQty(product.id, 0, null);
      return;
    }
    if (cartQtyDefault === 0) {
      add({
        productId: product.id,
        variantKey: null,
        variantSku: null,
        sku: product.sku,
        name: product.name,
        packSize: product.pack_size,
        unit: product.unit,
        unitPrice: product.unitPrice!,
        priceByWeight: Boolean(product.price_by_weight),
        quantity: n,
      });
    } else {
      setQty(product.id, n, null);
    }
  }
  function openVariantPicker(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setVariantOpen(true);
  }

  // Resolve per-variant prices once so VariantPickerSheet doesn't duplicate
  // the resolvePrice machinery. Falls back to wholesale_price if the parent
  // didn't override.
  const defaultVariantPrices: Record<string, number | null> = {};
  for (const opt of packOptions) {
    defaultVariantPrices[opt.key] = opt.wholesale_price ?? opt.retail_price ?? null;
  }

  const richSize = product.case_pack ?? product.pack_size;
  const sizeLabel = richSize ?? product.unit;
  // Switch the prefix to a middot when the size already contains its own
  // slash (e.g. "4 / gallon" or "9/10 oz"). Avoids "$20.00 / 4 / gallon"
  // which reads as nonsense — middot reads as "for".
  const sep = richSize ? "·" : "/";
  const price = product.unitPrice != null ? money(product.unitPrice) : "—";
  // Display name with producer prefix + size suffix stripped — both are
  // shown elsewhere on the card so duplicating them in the title eats
  // the readable name area.
  const displayName = displayProductName(
    product.name,
    product.producer,
    product.pack_size,
    product.case_pack,
  );

  // ───────── Compact (vertical scroll-strip card) ─────────
  if (variant === "compact") {
    return (
      <>
      <div
        className={`group/card relative w-full h-full flex flex-col rounded-xl border border-black/10 bg-white overflow-hidden snap-start transition-colors duration-150 [@media(hover:hover)]:hover:border-black/20 ${paused ? "opacity-70" : ""}`}
      >
        <Link
          href={detailHref}
          aria-label={product.name}
          className="absolute inset-x-0 top-0 bottom-[64px] z-0"
        />

        <div className="relative aspect-[4/3] flex items-center justify-center bg-white pointer-events-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={productImage(product)}
            alt=""
            className="max-h-[88%] max-w-[88%] object-contain mix-blend-multiply"
          />
          <Badge paused={paused} weekOff={!product.available_this_week && !paused} />
        </div>

        <div className="relative px-3 pt-2 pb-2 flex flex-col gap-0.5 pointer-events-none">
          {product.producer && producerHref ? (
            <Link
              href={producerHref}
              className="text-[11px] font-medium uppercase tracking-wider text-brand-green-dark truncate hover:underline pointer-events-auto"
            >
              {product.producer}
            </Link>
          ) : null}
          <div
            className="text-[14px] font-medium leading-snug text-ink-primary truncate"
            title={product.name}
          >
            {displayName}
          </div>
          <div className="text-[12px] text-ink-secondary truncate mt-0.5">
            <span className="tabular font-medium text-ink-primary">{price}</span>
            <span className="text-ink-tertiary"> {sep} {sizeLabel}</span>
          </div>
        </div>

        <div className="relative pointer-events-auto px-2 pb-2 mt-auto">
          <Stepper
            available={available}
            cartQty={cartQty}
            onAdd={addOne}
            onSub={sub}
            onSet={hasVariants ? undefined : applyDirectQty}
            fullWidth
          />
        </div>
      </div>
      <SheetPortal />
      </>
    );
  }

  // ───────── Grid variant ─────────
  if (variant === "grid") {
    return (
      <>
      <div
        className={`group/card relative rounded-xl border border-black/10 bg-white overflow-hidden flex flex-col transition-all duration-150 [@media(hover:hover)]:hover:-translate-y-px [@media(hover:hover)]:hover:border-black/20 [@media(hover:hover)]:hover:shadow-card ${paused ? "opacity-70" : ""}`}
      >
        <Link
          href={detailHref}
          aria-label={product.name}
          className="absolute inset-x-0 top-0 bottom-[64px] z-0"
        />

        <div className="relative aspect-[4/3] flex items-center justify-center p-3 pointer-events-none bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={productImage(product)}
            alt=""
            className="max-h-full max-w-full object-contain mix-blend-multiply transition-transform duration-150 [@media(hover:hover)]:group-hover/card:scale-[1.03]"
          />
          <Badge paused={paused} weekOff={!product.available_this_week && !paused} />
        </div>

        <div className="relative px-3 pt-2 pb-2 flex flex-col gap-0.5 pointer-events-none">
          {product.producer && producerHref ? (
            <Link
              href={producerHref}
              className="text-[11px] font-medium uppercase tracking-wider text-brand-green-dark truncate hover:underline pointer-events-auto"
            >
              {product.producer}
            </Link>
          ) : null}
          <div
            className="display text-[15px] font-semibold leading-snug text-ink-primary truncate"
            title={product.name}
          >
            {displayName}
          </div>
          <div className="text-[13px] text-ink-secondary truncate mt-0.5">
            <span className="tabular font-semibold text-ink-primary">{price}</span>
            <span className="text-ink-tertiary"> {sep} {sizeLabel}</span>
          </div>
        </div>

        <div className="relative pointer-events-auto px-3 pb-3 mt-auto">
          <Stepper
            available={available}
            cartQty={cartQty}
            onAdd={addOne}
            onSub={sub}
            onSet={hasVariants ? undefined : applyDirectQty}
            fullWidth
          />
        </div>
      </div>
      <SheetPortal />
      </>
    );
  }

  // ───────── Row variant (full-width list row) ─────────
  return (
    <div
      className={`group/card relative flex items-center gap-3 px-4 py-3 bg-white border-b border-black/[0.06] transition-colors duration-150 active:bg-bg-secondary ${paused ? "opacity-70" : ""}`}
    >
      <Link href={detailHref} aria-label={product.name} className="absolute inset-0 z-0" />

      <div className="relative h-16 w-16 shrink-0 rounded-md overflow-hidden bg-white flex items-center justify-center pointer-events-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={productImage(product)}
          alt=""
          className="max-h-[88%] max-w-[88%] object-contain mix-blend-multiply"
        />
        {cartQty > 0 ? (
          <span className="absolute top-0 left-0 min-w-[18px] h-[18px] px-1 rounded-br bg-accent-gold text-white text-[11px] font-semibold flex items-center justify-center tabular">
            {cartQty}
          </span>
        ) : null}
      </div>

      <div className="flex-1 min-w-0 pointer-events-none">
        {product.producer && producerHref ? (
          <Link
            href={producerHref}
            className="block max-w-full truncate text-[11px] font-medium uppercase tracking-wider text-brand-green-dark hover:underline pointer-events-auto"
          >
            {product.producer}
          </Link>
        ) : null}
        <div className="text-[15px] font-medium leading-snug text-ink-primary line-clamp-1 mt-0.5" title={product.name}>
          {displayName}
        </div>
        <div className="text-[13px] text-ink-secondary mt-0.5 truncate">
          <span className="tabular font-medium text-ink-primary">{price}</span>
          <span className="text-ink-tertiary"> / {sizeLabel}</span>
          {paused ? <span className="ml-2 badge badge-gold">Paused</span> : null}
          {!product.available_this_week && !paused ? (
            <span className="ml-2 badge badge-gray">Week off</span>
          ) : null}
        </div>
      </div>

      <div className="relative shrink-0 pointer-events-auto">
        <Stepper
          available={available}
          cartQty={cartQty}
          onAdd={addOne}
          onSub={sub}
          onSet={hasVariants ? undefined : applyDirectQty}
        />
      </div>
      <SheetPortal />
    </div>
  );

  // Helper rendered in every variant so the picker sheet is available
  // regardless of card layout. Closes over local state.
  function SheetPortal() {
    if (!hasVariants) return null;
    return (
      <VariantPickerSheet
        open={variantOpen}
        onClose={() => setVariantOpen(false)}
        product={product}
        defaultUnitPrice={product.unitPrice}
        defaultVariantPrices={defaultVariantPrices}
      />
    );
  }
}

function Badge({ paused, weekOff }: { paused: boolean; weekOff: boolean }) {
  if (paused)
    return (
      <span className="absolute top-2 right-2 badge badge-gold text-[10px]">Paused</span>
    );
  if (weekOff)
    return (
      <span className="absolute top-2 right-2 badge-gray bg-white/90 text-[10px]">
        Week off
      </span>
    );
  return null;
}

/**
 * 48dp stepper. Two states:
 *   qty = 0  → single "+ Add" button (full-width when fullWidth, square otherwise)
 *   qty > 0  → −/N/+ pill (full-width when fullWidth, fixed-width otherwise)
 */
function Stepper({
  available,
  cartQty,
  onAdd,
  onSub,
  onSet,
  fullWidth,
}: {
  available: boolean;
  cartQty: number;
  onAdd: (e: React.MouseEvent) => void;
  onSub: (e: React.MouseEvent) => void;
  /** Inline qty input commit. If omitted, the qty digit is read-only. */
  onSet?: (next: number) => void;
  fullWidth?: boolean;
}) {
  if (!available) {
    return (
      <div className="h-12 flex items-center justify-center text-[12px] text-ink-tertiary">
        Unavailable
      </div>
    );
  }

  const wrap = fullWidth ? "w-full justify-between" : "shrink-0";

  if (cartQty > 0) {
    return (
      <div className={`${wrap} flex items-center gap-2`}>
        <button
          onClick={onSub}
          className="h-11 w-11 flex items-center justify-center rounded-full border-2 border-brand-green-dark text-brand-green-dark hover:bg-brand-green-tint focus:outline-none focus:ring-2 focus:ring-brand-green/40 transition-colors duration-150 active:scale-[0.97] shrink-0"
          aria-label={cartQty === 1 ? "Remove from cart" : "Remove one"}
        >
          {cartQty === 1 ? <TrashIcon /> : <span className="text-xl leading-none">−</span>}
        </button>
        {onSet ? (
          <QtyInput
            value={cartQty}
            onSet={onSet}
            className="h-11 flex-1 min-w-0 max-w-[64px] text-center tabular text-[15px] font-semibold rounded-md border border-black/15 bg-white text-ink-primary focus:outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 transition-colors duration-150"
          />
        ) : (
          <div className="h-11 flex-1 min-w-0 max-w-[64px] flex items-center justify-center tabular text-[15px] font-semibold rounded-md border border-black/15 bg-white text-ink-primary">
            {cartQty}
          </div>
        )}
        <button
          onClick={onAdd}
          className="h-11 w-11 flex items-center justify-center rounded-full bg-brand-green-dark text-white hover:bg-brand-green-dark/90 focus:outline-none focus:ring-2 focus:ring-brand-green/40 transition-colors duration-150 active:scale-[0.97] shrink-0"
          aria-label="Add one"
        >
          <span className="text-xl leading-none">+</span>
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={onAdd}
      className={`${fullWidth ? "w-full" : "w-11 shrink-0"} h-11 flex items-center justify-center gap-1.5 rounded-full bg-brand-green-dark text-white text-[14px] font-semibold hover:bg-brand-green-dark/90 focus:outline-none focus:ring-2 focus:ring-brand-green/40 transition-colors duration-150 active:scale-[0.97]`}
      aria-label="Add to cart"
    >
      <span className="text-lg leading-none">+</span>
      {fullWidth ? <span>Add</span> : null}
    </button>
  );
}

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

/**
 * Best-effort haptic tick. Silent no-op on iOS Safari.
 */
function haptic(ms: number) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      (navigator as Navigator & { vibrate: (p: number | number[]) => boolean }).vibrate(ms);
    } catch {
      /* ignore */
    }
  }
}
