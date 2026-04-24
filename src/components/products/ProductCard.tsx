"use client";

import Link from "next/link";
import type { Product } from "@/lib/supabase/types";
import { useCart } from "@/lib/cart/store";
import { productImage } from "@/lib/utils/product-image";
import { money } from "@/lib/utils/format";

export type PricedProduct = Product & { unitPrice: number | null };

type Variant = "grid" | "compact";

/**
 * Single canonical product card. Two visual variants share all cart +
 * availability logic; they differ only in layout:
 *   - grid:    vertical, aspect-[2/1] image on top, fills a grid cell
 *   - compact: horizontal, 48px thumb left, fills a scroll-strip cell
 *
 * The whole card is a stub link to /catalog/[id] (opens the modal via the
 * @modal parallel route). The +/- stepper opts back into pointer events so
 * cart actions don't trip the link.
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
  const available = product.available_this_week && product.unitPrice != null;

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
    setQty(product.id, Math.max(0, cartQty - 1), null);
  }

  // Prefer the richer pack label: case_pack ("2X12LB AVG") → pack_size
  // ("9/10 OZ") → unit ("lb"). Middot separator when we have a pack,
  // slash when we only have the unit.
  const richSize = product.case_pack ?? product.pack_size;
  const sizeLabel = richSize ?? product.unit;
  const sep = richSize ? "·" : "/";

  const price =
    product.unitPrice != null ? money(product.unitPrice) : "—";

  if (variant === "grid") {
    return (
      <div className="relative rounded-lg border border-black/10 bg-white overflow-hidden transition hover:border-black/20 flex flex-col">
        <Link href={detailHref} aria-label={product.name} className="absolute inset-0 z-0" />

        <div className="relative aspect-[2/1] flex items-center justify-center p-1 pointer-events-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={productImage(product)}
            alt=""
            className="max-h-full max-w-full object-contain mix-blend-multiply"
          />
          {!product.available_this_week ? (
            <span className="absolute top-1 right-1 badge-gray bg-white/90 text-[9px]">limited</span>
          ) : null}
          {cartQty > 0 ? (
            <span className="absolute top-1 left-1 min-w-[18px] h-[18px] px-1 rounded bg-accent-gold text-white text-[10px] font-semibold flex items-center justify-center tabular">
              {cartQty} in cart
            </span>
          ) : null}
        </div>

        <div className="relative px-2 pt-1 pointer-events-none">
          <div
            className="display text-[13px] font-semibold leading-tight text-ink-primary truncate"
            title={product.name}
          >
            {product.name}
          </div>
        </div>

        {product.producer && producerHref ? (
          <div className="relative px-2 pt-0.5 pointer-events-none">
            <Link
              href={producerHref}
              className="block max-w-full truncate text-[10px] font-medium uppercase tracking-wider text-brand-green-dark leading-none hover:underline pointer-events-auto"
            >
              {product.producer}
            </Link>
          </div>
        ) : null}

        <div className="relative px-2 pb-1.5 pt-1 flex items-center justify-between gap-1 pointer-events-auto">
          <div className="min-w-0 truncate pointer-events-none">
            <span className="tabular text-[13px] font-semibold text-ink-primary">{price}</span>
            <span className="text-[9px] text-ink-tertiary uppercase ml-1">
              {sep} {sizeLabel}
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
    );
  }

  // compact
  return (
    <div className="w-full h-full relative rounded-lg border border-black/10 bg-white overflow-hidden transition hover:border-black/20">
      <Link href={detailHref} aria-label={product.name} className="absolute inset-0 z-0" />

      <div className="relative flex gap-2 p-1.5 pointer-events-none">
        <div className="relative h-12 w-12 shrink-0 rounded-md overflow-hidden bg-black/[0.04] flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={productImage(product)}
            alt=""
            className="max-h-full max-w-full object-contain mix-blend-multiply"
          />
          {cartQty > 0 ? (
            <span className="absolute top-0 left-0 min-w-[14px] h-[14px] px-1 rounded-br bg-accent-gold text-white text-[9px] font-semibold flex items-center justify-center tabular">
              {cartQty}
            </span>
          ) : null}
        </div>

        <div className="flex-1 min-w-0">
          <div
            className="display text-[12px] font-semibold leading-tight text-ink-primary truncate"
            title={product.name}
          >
            {product.name}
          </div>
          {product.producer && producerHref ? (
            <Link
              href={producerHref}
              className="block max-w-full truncate text-[9px] font-medium uppercase tracking-wider text-brand-green-dark leading-none mt-0.5 hover:underline pointer-events-auto"
            >
              {product.producer}
            </Link>
          ) : null}
          <div className="mt-0.5 flex items-center justify-between gap-1">
            <div className="min-w-0 truncate">
              <span className="tabular text-[12px] font-semibold text-ink-primary">{price}</span>
              <span className="text-[9px] text-ink-tertiary uppercase ml-1">
                {sep} {sizeLabel}
              </span>
            </div>
            <div className="pointer-events-auto">
              <Stepper
                size="sm"
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
  if (!available) return size === "md" ? <span className="text-[10px] text-ink-tertiary">—</span> : null;
  const box = size === "md" ? "h-6 w-6" : "h-5 w-5";
  const txt = size === "md" ? "text-sm" : "text-xs";
  const qtyW = size === "md" ? "w-4 text-xs" : "w-3 text-[10px]";
  if (cartQty > 0) {
    return (
      <div className="flex items-center gap-0 shrink-0">
        <button
          onClick={onSub}
          className={`${box} rounded-full flex items-center justify-center text-brand-green-dark hover:bg-brand-green-tint transition`}
          aria-label={cartQty === 1 ? "Remove from cart" : "Remove one"}
        >
          {cartQty === 1 ? <TrashIcon size={size} /> : <span className={`${txt} leading-none`}>−</span>}
        </button>
        <span className={`tabular ${qtyW} font-semibold text-center`}>{cartQty}</span>
        <button
          onClick={onAdd}
          className={`${box} rounded-full bg-brand-green-dark text-white flex items-center justify-center ${txt} leading-none hover:bg-brand-green-dark/90 transition`}
          aria-label="Add one"
        >
          +
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={onAdd}
      className={`${box} rounded-full bg-brand-green-dark text-white flex items-center justify-center ${txt} leading-none hover:bg-brand-green-dark/90 transition shrink-0`}
      aria-label="Add to cart"
    >
      +
    </button>
  );
}

function TrashIcon({ size }: { size: "sm" | "md" }) {
  const px = size === "md" ? 12 : 10;
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
