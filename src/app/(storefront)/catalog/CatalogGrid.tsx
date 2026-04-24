"use client";

import Link from "next/link";
import type { Product } from "@/lib/supabase/types";
import { useCart } from "@/lib/cart/store";
import { productImage } from "@/lib/utils/product-image";
import { money } from "@/lib/utils/format";

type PricedProduct = Product & { unitPrice: number | null };

export function CatalogGrid({
  products,
  fromGroup,
}: {
  products: PricedProduct[];
  fromGroup: string | null;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 px-3 md:px-0">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} fromGroup={fromGroup} />
      ))}
    </div>
  );
}

function ProductCard({
  product,
  fromGroup,
}: {
  product: PricedProduct;
  fromGroup: string | null;
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

  return (
    <div className="relative rounded-lg border border-black/[0.06] bg-bg-primary overflow-hidden transition hover:border-black/10 flex flex-col">
      <Link href={detailHref} aria-label={product.name} className="absolute inset-0 z-0" />

      {/* Squat image — placeholder SVGs don't dominate at 2:1 */}
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

      {/* Name — single line, truncated */}
      <div className="relative px-2 pt-1 pointer-events-none">
        <div
          className="display text-[13px] font-semibold leading-tight text-ink-primary truncate"
          title={product.name}
        >
          {product.name}
        </div>
      </div>

      {/* Producer — small brand-green link under the name */}
      {product.producer && producerHref ? (
        <div className="relative px-2 pointer-events-none">
          <Link
            href={producerHref}
            className="block max-w-full truncate text-[10px] font-medium uppercase tracking-wider text-brand-green-dark hover:underline pointer-events-auto"
          >
            {product.producer}
          </Link>
        </div>
      ) : null}

      {/* Price + action — price shows size inline ("$35 · 9/10oz") */}
      <div className="relative px-2 pb-1.5 pt-0.5 flex items-center justify-between gap-1 pointer-events-auto">
        <div className="min-w-0 truncate">
          <span className="tabular text-[13px] font-semibold text-ink-primary">
            {product.unitPrice != null ? money(product.unitPrice) : "—"}
          </span>
          <span className="text-[9px] text-ink-tertiary uppercase ml-1">
            {sep} {sizeLabel}
          </span>
        </div>
        {available ? (
          cartQty > 0 ? (
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={sub}
                className="h-6 w-6 rounded-full flex items-center justify-center text-brand-green-dark hover:bg-brand-green-tint transition"
                aria-label={cartQty === 1 ? "Remove from cart" : "Remove one"}
              >
                {cartQty === 1 ? <TrashIcon /> : <span className="text-sm leading-none">−</span>}
              </button>
              <span className="tabular text-xs font-semibold w-4 text-center">{cartQty}</span>
              <button
                onClick={addOne}
                className="h-6 w-6 rounded-full bg-brand-green-dark text-white flex items-center justify-center text-sm leading-none hover:bg-brand-green-dark/90 transition"
                aria-label="Add one"
              >
                +
              </button>
            </div>
          ) : (
            <button
              onClick={addOne}
              className="h-6 w-6 rounded-full bg-brand-green-dark text-white flex items-center justify-center text-sm leading-none hover:bg-brand-green-dark/90 transition shrink-0"
              aria-label="Add to cart"
            >
              +
            </button>
          )
        ) : (
          <span className="text-[10px] text-ink-tertiary">—</span>
        )}
      </div>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
