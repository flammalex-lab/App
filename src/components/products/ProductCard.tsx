"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { PackOption, Product } from "@/lib/supabase/types";
import { useCart } from "@/lib/cart/store";
import { productPhoto } from "@/lib/utils/product-image";
import { displayProductName } from "@/lib/utils/product-display";
import { money } from "@/lib/utils/format";
import { QtyInput } from "@/components/ui/QtyInput";
import { VariantPickerSheet } from "@/components/products/VariantPickerSheet";
import { ProductCardFallback } from "@/components/products/ProductCardFallback";

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
 * Stepper sized at 44px tap targets — exceeds iOS HIG (44) and meets
 * Material 3 (48 was overshoot for the visual density we needed).
 * Circular brand-blue buttons everywhere; green is reserved for the
 * commit moment (Place order, Confirm).
 *
 * Visual signals on the media:
 *   - gold-star "In guide" badge at top-left when in the buyer's guide
 *     (compact/grid; row uses an inline flag beside the producer line)
 *
 * The in-cart state is conveyed by the stepper alone (it swaps from
 * "+ Add" to the −/N/+ pill once a product is in the cart). A separate
 * top-right `× N` badge was tried and dropped — two pieces of chrome
 * encoding the same fact read as noisy.
 *
 * When the product has no real photo (no `image_url`), the media slot
 * renders ProductCardFallback — a dot-grid brand-blue tile featuring
 * the product name — instead of an FLF-logo placeholder.
 */
export function ProductCard({
  product,
  variant,
  fromGroup,
  inGuide = false,
}: {
  product: PricedProduct;
  variant: Variant;
  fromGroup?: string | null;
  /**
   * Whether this product is in the active buyer's order guide. Used to
   * render the "In guide" badge. Default false — the buyer's guide
   * isn't fetched on every page, so callers must opt in.
   */
  inGuide?: boolean;
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
  const displayName = displayProductName(
    product.name,
    product.producer,
    product.pack_size,
    product.case_pack,
  );

  const photo = productPhoto(product);
  const weekOff = !product.available_this_week && !paused;

  // ───────── Compact (vertical scroll-strip card) ─────────
  if (variant === "compact") {
    return (
      <>
      <div
        className={`group/card relative w-full h-full flex flex-col rounded-xl border border-black/10 bg-white overflow-hidden snap-start transition-colors duration-150 [@media(hover:hover)]:hover:border-black/20 focus-within:ring-2 focus-within:ring-brand-blue/40 focus-within:border-brand-blue ${paused ? "opacity-70" : ""}`}
      >
        <Link
          href={detailHref}
          aria-label={product.name}
          scroll={false}
          className="absolute inset-x-0 top-0 bottom-[64px] z-0"
        />

        <CardMedia
          aspect="square"
          photo={photo}
          product={product}
          fallbackSize="md"
          sizes="(max-width: 768px) 45vw, 200px"
          inGuide={inGuide}
          paused={paused}
          weekOff={weekOff}
        />

        <div className="relative px-3 pt-2 pb-2 flex flex-col gap-0.5 pointer-events-none">
          <ProducerEyebrow producer={product.producer} producerHref={producerHref} />
          <div
            className="text-[14px] font-semibold leading-snug text-ink-primary truncate"
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
        className={`group/card relative rounded-xl border border-black/10 bg-white overflow-hidden flex flex-col transition-all duration-150 [@media(hover:hover)]:hover:-translate-y-px [@media(hover:hover)]:hover:border-black/20 [@media(hover:hover)]:hover:shadow-card focus-within:ring-2 focus-within:ring-brand-blue/40 focus-within:border-brand-blue ${paused ? "opacity-70" : ""}`}
      >
        <Link
          href={detailHref}
          aria-label={product.name}
          scroll={false}
          className="absolute inset-x-0 top-0 bottom-[64px] z-0"
        />

        <CardMedia
          aspect="square"
          photo={photo}
          product={product}
          fallbackSize="md"
          sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
          inGuide={inGuide}
          paused={paused}
          weekOff={weekOff}
          zoomOnHover
        />

        <div className="relative px-3 pt-2 pb-2 flex flex-col gap-0.5 pointer-events-none">
          <ProducerEyebrow producer={product.producer} producerHref={producerHref} />
          <div
            className="display text-[15px] font-semibold leading-snug text-ink-primary truncate mt-0.5"
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
      <Link href={detailHref} aria-label={product.name} scroll={false} className="absolute inset-0 z-0" />

      <div className="relative h-20 w-20 shrink-0 rounded-md overflow-hidden bg-bg-secondary flex items-center justify-center pointer-events-none">
        {photo ? (
          <Image
            src={photo}
            alt=""
            fill
            sizes="80px"
            className="object-contain mix-blend-multiply"
          />
        ) : (
          <ProductCardFallback product={product} size="sm" />
        )}
      </div>

      <div className="flex-1 min-w-0 pointer-events-none">
        <div className="flex items-center gap-1.5 min-w-0">
          <ProducerEyebrow producer={product.producer} producerHref={producerHref} />
          {inGuide ? <InGuideFlag /> : null}
        </div>
        <div className="text-[15px] font-semibold leading-snug text-ink-primary line-clamp-1 mt-0.5" title={product.name}>
          {displayName}
        </div>
        <div className="text-[13px] text-ink-secondary mt-0.5 truncate">
          <span className="tabular font-medium text-ink-primary">{price}</span>
          <span className="text-ink-tertiary"> {sep} {sizeLabel}</span>
          {paused ? <span className="ml-2 badge badge-gold">Paused</span> : null}
          {weekOff ? <span className="ml-2 badge badge-gray">Week off</span> : null}
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

/** Producer name in uppercase eyebrow caps. Links to producer filter when present. */
function ProducerEyebrow({
  producer,
  producerHref,
}: {
  producer: string | null;
  producerHref: string | null;
}) {
  if (!producer) return null;
  const baseClass =
    "text-[10px] uppercase tracking-[0.08em] font-semibold text-ink-tertiary truncate leading-tight";
  if (producerHref) {
    return (
      <Link
        href={producerHref}
        className={`${baseClass} hover:text-ink-secondary hover:underline pointer-events-auto focus:outline-none focus:ring-2 focus:ring-brand-blue/40 rounded-sm`}
      >
        {producer}
      </Link>
    );
  }
  return <span className={baseClass}>{producer}</span>;
}

/**
 * Media tile with image (or fallback) + In-guide badge + week-off /
 * paused overlays. Used by compact + grid variants.
 *
 * The in-cart state lives on the stepper below the media, not on a
 * top-right pill — see the component doc-block above for rationale.
 */
function CardMedia({
  aspect,
  photo,
  product,
  fallbackSize,
  sizes,
  inGuide,
  paused,
  weekOff,
  zoomOnHover,
}: {
  aspect: "square";
  photo: string | null;
  product: PricedProduct;
  fallbackSize: "sm" | "md" | "lg";
  sizes: string;
  inGuide: boolean;
  paused: boolean;
  weekOff: boolean;
  zoomOnHover?: boolean;
}) {
  return (
    <div
      className={`relative ${aspect === "square" ? "aspect-square" : ""} flex items-center justify-center bg-white pointer-events-none overflow-hidden`}
    >
      {photo ? (
        <Image
          src={photo}
          alt=""
          fill
          sizes={sizes}
          className={`object-contain mix-blend-multiply transition-transform duration-150 ${zoomOnHover ? "[@media(hover:hover)]:group-hover/card:scale-[1.03]" : ""}`}
        />
      ) : (
        <ProductCardFallback product={product} size={fallbackSize} />
      )}

      {inGuide ? <InGuideBadge /> : null}
      {paused ? (
        <span className="absolute top-2 right-2 badge badge-gold text-[10px]">Paused</span>
      ) : null}
      {!paused && weekOff ? (
        <span className="absolute top-2 right-2 badge-gray bg-white/90 text-[10px]">
          Week off
        </span>
      ) : null}
    </div>
  );
}

/** Compact/grid: white pill with gold star + "In guide" copy. */
function InGuideBadge() {
  return (
    <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white text-[#8a690f] text-[11px] font-semibold leading-none border border-accent-gold/40 shadow-card pointer-events-none">
      <StarIcon />
      In guide
    </span>
  );
}

/** Row variant: tiny gold-tint flag beside the producer eyebrow. */
function InGuideFlag() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none text-[#8a690f] bg-accent-gold/15 shrink-0">
      <StarIcon />
      In guide
    </span>
  );
}

function StarIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="currentColor"
      aria-hidden
      className="text-accent-gold"
    >
      <path d="M6 .5l1.6 3.7 4 .4-3 2.8.9 4-3.5-2.1-3.5 2.1.9-4-3-2.8 4-.4z" />
    </svg>
  );
}

/**
 * 44px stepper. Two states:
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

  // Stepper colors: brand-blue everywhere. Green is reserved for the
  // commit step (Place order, Confirm standing order) per the design system.
  if (cartQty > 0) {
    return (
      <div className={`${wrap} flex items-center gap-2`}>
        <button
          onClick={onSub}
          className="h-11 w-11 flex items-center justify-center rounded-full border-2 border-brand-blue text-brand-blue hover:bg-brand-blue-tint focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors duration-150 active:scale-[0.97] shrink-0"
          aria-label={cartQty === 1 ? "Remove from cart" : "Remove one"}
        >
          {cartQty === 1 ? <TrashIcon /> : <span className="text-xl leading-none">−</span>}
        </button>
        {onSet ? (
          <QtyInput
            value={cartQty}
            onSet={onSet}
            className="h-11 flex-1 min-w-0 max-w-[64px] text-center tabular text-[15px] font-semibold rounded-md border border-black/15 bg-white text-ink-primary focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30 transition-colors duration-150"
          />
        ) : (
          <div className="h-11 flex-1 min-w-0 max-w-[64px] flex items-center justify-center tabular text-[15px] font-semibold rounded-md border border-black/15 bg-white text-ink-primary">
            {cartQty}
          </div>
        )}
        <button
          onClick={onAdd}
          className="h-11 w-11 flex items-center justify-center rounded-full bg-brand-blue text-white hover:bg-brand-blue-dark focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors duration-150 active:scale-[0.97] shrink-0"
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
      className={`${fullWidth ? "w-full" : "w-11 shrink-0"} h-11 flex items-center justify-center gap-1.5 rounded-full bg-brand-blue text-white text-[14px] font-semibold hover:bg-brand-blue-dark focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors duration-150 active:scale-[0.97]`}
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
