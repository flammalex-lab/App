"use client";

import Link from "next/link";
import type { Product } from "@/lib/supabase/types";
import { useCart } from "@/lib/cart/store";
import { productImage } from "@/lib/utils/product-image";
import { money } from "@/lib/utils/format";

type PricedProduct = Product & { unitPrice: number | null };

const NEW_DAYS = 60;
function isRecent(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && Date.now() - t < NEW_DAYS * 24 * 60 * 60 * 1000;
}

export function CatalogGrid({
  products,
  fromGroup,
}: {
  products: PricedProduct[];
  fromGroup: string | null;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 px-4 md:px-0">
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

  function addOne() {
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
  function sub() {
    setQty(product.id, Math.max(0, cartQty - 1), null);
  }

  return (
    <div className="relative rounded-xl border border-black/[0.06] bg-bg-primary overflow-hidden transition hover:border-black/10 hover:shadow-[0_2px_10px_rgba(22,22,22,0.05)] flex flex-col">
      {/* Stub link covers the whole card; producer + cart buttons opt back in. */}
      <Link href={detailHref} aria-label={product.name} className="absolute inset-0 z-0" />

      {/* Image — smaller aspect so placeholders don't dominate */}
      <div className="relative aspect-[3/2] flex items-center justify-center p-1.5 pointer-events-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={productImage(product)}
          alt=""
          className="max-h-full max-w-full object-contain mix-blend-multiply"
        />
        {!product.available_this_week ? (
          <span className="absolute top-1.5 right-1.5 badge-gray bg-white/90 text-[9px]">limited</span>
        ) : null}
        {isRecent(product.created_at) ? (
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide rounded bg-accent-gold text-white shadow-sm">
            New
          </span>
        ) : null}
        {cartQty > 0 ? (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-accent-gold text-white text-xs font-semibold rounded-full h-11 w-11 flex flex-col items-center justify-center leading-tight shadow-sm pointer-events-none">
            <span className="tabular text-sm">{cartQty}</span>
            <span className="text-[8px] font-normal opacity-90">in cart</span>
          </div>
        ) : null}
      </div>

      {/* Text block — tighter: producer · name · pack size inline */}
      <div className="relative px-2.5 pt-1.5 pb-1 pointer-events-none">
        {product.producer && producerHref ? (
          <Link
            href={producerHref}
            className="block max-w-full truncate text-[10px] font-medium uppercase tracking-wider text-brand-green-dark hover:underline pointer-events-auto"
          >
            {product.producer}
          </Link>
        ) : null}
        <div
          className="display text-[13px] font-semibold leading-tight text-ink-primary line-clamp-2"
          title={product.name}
        >
          {product.name}
        </div>
        <div className="text-[10px] uppercase tracking-wide text-ink-tertiary mt-0.5">
          {product.pack_size ?? product.unit}
        </div>
      </div>

      {/* Price + action row — no extra top border, tighter padding */}
      <div className="relative px-2.5 pb-2 pt-1 flex items-center justify-between gap-2 pointer-events-auto">
        <div className="min-w-0">
          <span className="tabular text-sm font-semibold text-ink-primary">
            {product.unitPrice != null ? money(product.unitPrice) : "—"}
          </span>
          <span className="text-[10px] text-ink-tertiary uppercase tracking-wide ml-1">
            / {product.unit}
          </span>
        </div>
        {available ? (
          cartQty > 0 ? (
            <div className="flex items-center gap-0.5">
              <button
                onClick={sub}
                className="h-7 w-7 rounded-full flex items-center justify-center text-brand-green-dark hover:bg-brand-green-tint transition"
                aria-label={cartQty === 1 ? "Remove from cart" : "Remove one"}
              >
                {cartQty === 1 ? <TrashIcon /> : <span className="text-base leading-none">−</span>}
              </button>
              <span className="tabular font-semibold text-sm w-5 text-center">{cartQty}</span>
              <button
                onClick={addOne}
                className="h-7 w-7 rounded-full bg-brand-green-dark text-white flex items-center justify-center text-base leading-none hover:bg-brand-green-dark/90 transition"
                aria-label="Add one"
              >
                +
              </button>
            </div>
          ) : (
            <button
              onClick={addOne}
              className="h-7 w-7 rounded-full bg-brand-green-dark text-white flex items-center justify-center text-base leading-none hover:bg-brand-green-dark/90 transition"
              aria-label="Add to cart"
            >
              +
            </button>
          )
        ) : (
          <span className="text-xs text-ink-tertiary">—</span>
        )}
      </div>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
