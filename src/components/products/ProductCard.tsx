"use client";

import Link from "next/link";
import type { Product } from "@/lib/supabase/types";
import { useCart } from "@/lib/cart/store";
import { productImage } from "@/lib/utils/product-image";
import { money } from "@/lib/utils/format";

export type PricedProduct = Product & { unitPrice: number | null };

type Variant = "grid" | "compact" | "row";

/**
 * Single canonical product card. Three visual variants share all cart +
 * availability logic; they differ only in layout.
 *
 *   - grid:    flat tile in a column grid (catalog grid view)
 *   - compact: horizontal scroll-strip card (catalog landing strips)
 *   - row:     full-width list row (producer-grouped category view)
 *
 * All three meet 36pt minimum tap targets on stepper controls; titles
 * are 14-15px floor for readability.
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
  const cartQty = useCart(
    (s) =>
      s.lines.find((l) => l.productId === product.id && l.variantKey === null)?.quantity ?? 0,
  );
  // "Paused" = admin has toggled this product off since it was added to
  // this buyer's guide/standing order. Render but gray out + block add
  // so buyers see why the item no longer works.
  const paused = product.available_b2b === false;
  const available = product.available_this_week && product.unitPrice != null && !paused;

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
    haptic(6);
    setQty(product.id, Math.max(0, cartQty - 1), null);
  }

  const richSize = product.case_pack ?? product.pack_size;
  const sizeLabel = richSize ?? product.unit;

  const price = product.unitPrice != null ? money(product.unitPrice) : "—";

  // ───────── Grid variant ─────────
  if (variant === "grid") {
    return (
      <div
        className={`group/card relative rounded-xl border border-black/10 bg-white overflow-hidden flex flex-col transition-all duration-150 [@media(hover:hover)]:hover:-translate-y-px [@media(hover:hover)]:hover:border-black/20 [@media(hover:hover)]:hover:shadow-card ${paused ? "opacity-70" : ""}`}
      >
        <Link href={detailHref} aria-label={product.name} className="absolute inset-0 z-0" />

        <div className="relative aspect-[2/1] flex items-center justify-center p-2 pointer-events-none bg-gradient-radial-soft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={productImage(product)}
            alt=""
            className="max-h-full max-w-full object-contain mix-blend-multiply transition-transform duration-150 [@media(hover:hover)]:group-hover/card:scale-[1.03]"
          />
          <Badge paused={paused} weekOff={!product.available_this_week && !paused} />
          {cartQty > 0 ? (
            <span className="absolute top-1.5 left-1.5 min-w-[20px] h-[20px] px-1.5 rounded-md bg-accent-gold text-white text-[11px] font-semibold flex items-center justify-center tabular shadow-sm">
              {cartQty}
            </span>
          ) : null}
        </div>

        <div className="relative px-3 pt-2 pb-2.5 pointer-events-none flex flex-col gap-0.5">
          <div
            className="display text-sm font-semibold leading-snug text-ink-primary line-clamp-2 min-h-[2.5em]"
            title={product.name}
          >
            {product.name}
          </div>
          {product.producer && producerHref ? (
            <Link
              href={producerHref}
              className="block max-w-full truncate text-[11px] font-medium uppercase tracking-wider text-brand-green-dark hover:underline pointer-events-auto"
            >
              {product.producer}
            </Link>
          ) : null}
          <div className="mt-1.5 flex items-center justify-between gap-1 pointer-events-auto">
            <div className="min-w-0 truncate pointer-events-none">
              <span className="tabular text-sm font-semibold text-ink-primary">{price}</span>
              <span className="text-[11px] text-ink-tertiary ml-1.5">
                / {sizeLabel}
              </span>
            </div>
            <Stepper
              size="md"
              available={available}
              cartQty={cartQty}
              onAdd={addOne}
              onSub={sub}
            />
          </div>
        </div>
      </div>
    );
  }

  // ───────── Row variant (full-width list row) ─────────
  if (variant === "row") {
    return (
      <div
        className={`group/card relative flex items-center gap-3 px-3 py-3 bg-white border-b border-black/[0.06] transition-colors duration-150 active:bg-bg-secondary ${paused ? "opacity-70" : ""}`}
      >
        <Link href={detailHref} aria-label={product.name} className="absolute inset-0 z-0" />

        <div className="relative h-14 w-14 shrink-0 rounded-md overflow-hidden bg-gradient-radial-soft flex items-center justify-center pointer-events-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={productImage(product)}
            alt=""
            className="max-h-full max-w-full object-contain mix-blend-multiply"
          />
          {cartQty > 0 ? (
            <span className="absolute top-0 left-0 min-w-[18px] h-[18px] px-1 rounded-br bg-accent-gold text-white text-[10px] font-semibold flex items-center justify-center tabular">
              {cartQty}
            </span>
          ) : null}
        </div>

        <div className="flex-1 min-w-0 pointer-events-none">
          <div className="text-[15px] font-medium leading-snug text-ink-primary line-clamp-1">
            {product.name}
          </div>
          {product.producer && producerHref ? (
            <Link
              href={producerHref}
              className="block max-w-full truncate text-[11px] font-medium uppercase tracking-wider text-brand-green-dark mt-0.5 hover:underline pointer-events-auto"
            >
              {product.producer}
            </Link>
          ) : null}
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
          <Stepper size="md" available={available} cartQty={cartQty} onAdd={addOne} onSub={sub} />
        </div>
      </div>
    );
  }

  // ───────── Compact variant (horizontal scroll-strip card) ─────────
  return (
    <div
      className={`group/card w-full h-full relative rounded-xl border border-black/10 bg-white overflow-hidden transition-colors duration-150 [@media(hover:hover)]:hover:border-black/20 ${paused ? "opacity-70" : ""}`}
    >
      <Link href={detailHref} aria-label={product.name} className="absolute inset-0 z-0" />

      <div className="relative flex gap-2.5 p-2 pointer-events-none">
        <div className="relative h-14 w-14 shrink-0 rounded-md overflow-hidden bg-gradient-radial-soft flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={productImage(product)}
            alt=""
            className="max-h-full max-w-full object-contain mix-blend-multiply"
          />
          {paused ? (
            <span className="absolute top-0 right-0 min-w-[16px] h-[16px] px-1 rounded-bl bg-accent-gold text-white text-[9px] font-semibold flex items-center justify-center uppercase tracking-wide">
              off
            </span>
          ) : cartQty > 0 ? (
            <span className="absolute top-0 left-0 min-w-[16px] h-[16px] px-1 rounded-br bg-accent-gold text-white text-[10px] font-semibold flex items-center justify-center tabular">
              {cartQty}
            </span>
          ) : null}
        </div>

        <div className="flex-1 min-w-0">
          <div
            className="text-[14px] font-medium leading-snug text-ink-primary line-clamp-2"
            title={product.name}
          >
            {product.name}
          </div>
          {product.producer && producerHref ? (
            <Link
              href={producerHref}
              className="block max-w-full truncate text-[10px] font-medium uppercase tracking-wider text-brand-green-dark mt-0.5 hover:underline pointer-events-auto"
            >
              {product.producer}
            </Link>
          ) : null}
          <div className="mt-1 flex items-center justify-between gap-1">
            <div className="min-w-0 truncate">
              <span className="tabular text-[13px] font-semibold text-ink-primary">{price}</span>
              <span className="text-[10px] text-ink-tertiary ml-1">/ {sizeLabel}</span>
            </div>
            <div className="pointer-events-auto">
              <Stepper
                size="md"
                available={available}
                cartQty={cartQty}
                onAdd={addOne}
                onSub={sub}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({ paused, weekOff }: { paused: boolean; weekOff: boolean }) {
  if (paused)
    return (
      <span className="absolute top-1.5 right-1.5 badge badge-gold text-[10px]">Paused</span>
    );
  if (weekOff)
    return (
      <span className="absolute top-1.5 right-1.5 badge-gray bg-white/90 text-[10px]">
        Week off
      </span>
    );
  return null;
}

/**
 * Combined −/qty/+ control. ~36pt tall, 8pt horizontal padding inside,
 * making each tap zone about 36×36 — meets iOS HIG (44) for the
 * combined pill and Material 3 (48) is a stretch but acceptable for
 * inline list controls.
 */
function Stepper({
  size,
  available,
  cartQty,
  onAdd,
  onSub,
}: {
  size: "sm" | "md";
  available: boolean;
  cartQty: number;
  onAdd: (e: React.MouseEvent) => void;
  onSub: (e: React.MouseEvent) => void;
}) {
  if (!available) return <span className="text-[10px] text-ink-tertiary">—</span>;
  const pill = "h-9 rounded-full bg-brand-green-dark text-white";
  const ghost = "h-9 rounded-full bg-bg-secondary text-brand-green-dark";

  if (cartQty > 0) {
    return (
      <div
        className={`${ghost} flex items-center transition-colors duration-150 hover:bg-brand-green-tint shrink-0`}
      >
        <button
          onClick={onSub}
          className="h-9 w-9 flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-brand-green/40"
          aria-label={cartQty === 1 ? "Remove from cart" : "Remove one"}
        >
          {cartQty === 1 ? <TrashIcon /> : <span className="text-base leading-none">−</span>}
        </button>
        <span className="tabular text-[13px] font-semibold w-5 text-center select-none">
          {cartQty}
        </span>
        <button
          onClick={onAdd}
          className="h-9 w-9 flex items-center justify-center rounded-full bg-brand-green-dark text-white focus:outline-none focus:ring-2 focus:ring-brand-green/40"
          aria-label="Add one"
        >
          <span className="text-base leading-none">+</span>
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={onAdd}
      className={`${pill} h-9 w-9 flex items-center justify-center hover:bg-brand-green-dark/90 transition-colors duration-150 shrink-0 focus:outline-none focus:ring-2 focus:ring-brand-green/40`}
      aria-label="Add to cart"
    >
      <span className="text-base leading-none">+</span>
    </button>
  );
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
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
 * Best-effort haptic tick. Silent no-op on iOS Safari (which doesn't
 * support navigator.vibrate); useful on Android Chrome to confirm taps.
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
