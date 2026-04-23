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

export function ScrollStrip({
  title,
  href,
  subtitle,
  products,
  emoji,
}: {
  title: string;
  href?: string;
  subtitle?: string;
  products: PricedProduct[];
  emoji?: string;
}) {
  if (products.length === 0) return null;
  return (
    <section className="mb-6">
      <div className="flex items-baseline justify-between px-4 md:px-0 mb-2">
        <h2 className="display text-lg tracking-tight">
          {emoji ? <span className="mr-1">{emoji}</span> : null}
          {title}
        </h2>
        {href ? (
          <Link href={href} className="text-xs text-brand-blue hover:underline">
            See all →
          </Link>
        ) : null}
      </div>
      {subtitle ? (
        <p className="text-xs text-ink-secondary px-4 md:px-0 mb-2">{subtitle}</p>
      ) : null}
      <div className="flex gap-3 overflow-x-auto px-4 md:px-0 pb-2 snap-x -mx-0">
        {products.map((p) => (
          <StripCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}

function StripCard({ product }: { product: PricedProduct }) {
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const cartQty = useCart(
    (s) =>
      s.lines.find((l) => l.productId === product.id && l.variantKey === null)?.quantity ?? 0,
  );
  const available = product.available_this_week && product.unitPrice != null;
  const detailHref = `/catalog/${product.id}`;
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
    <div className="shrink-0 w-[150px] snap-start card overflow-hidden relative hover:shadow-lg transition">
      {/* Stub link covers whole card; producer + cart buttons opt back in. */}
      <Link href={detailHref} aria-label={product.name} className="absolute inset-0 z-0" />

      <div className="relative aspect-square bg-bg-secondary pointer-events-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={productImage(product)}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        {!product.available_this_week ? (
          <span className="absolute top-1.5 right-1.5 badge-gray text-[9px] bg-white/90">
            limited
          </span>
        ) : null}
        {isRecent(product.created_at) ? (
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide rounded bg-accent-gold text-white shadow-sm">
            New
          </span>
        ) : null}
      </div>
      <div className="relative p-2 pr-9 pointer-events-none">
        <div className="text-[12px] font-medium leading-tight line-clamp-2">{product.name}</div>
        {product.producer && producerHref ? (
          <Link
            href={producerHref}
            className="mt-0.5 inline-block max-w-full truncate text-[10px] text-ink-tertiary hover:text-ink-secondary hover:underline transition pointer-events-auto"
          >
            {product.producer}
          </Link>
        ) : null}
        <div className="tabular text-[12px] mt-1">
          {product.unitPrice != null ? money(product.unitPrice) : "—"}
          <span className="text-ink-tertiary text-[10px]"> / {product.unit}</span>
        </div>
      </div>
      {available ? (
        cartQty > 0 ? (
          <div className="absolute bottom-2 right-2 flex items-center gap-0.5 bg-white rounded-full shadow-card border border-black/5 px-1 py-0.5 z-10">
            <button
              onClick={sub}
              className="h-6 w-6 rounded-full flex items-center justify-center text-sm hover:bg-bg-secondary"
              aria-label="Remove one"
            >
              {cartQty === 1 ? "🗑" : "−"}
            </button>
            <span className="tabular font-semibold text-xs w-4 text-center">{cartQty}</span>
            <button
              onClick={addOne}
              className="h-6 w-6 rounded-full bg-brand-green text-white flex items-center justify-center text-sm hover:bg-brand-green-dark transition"
              aria-label="Add one"
            >
              +
            </button>
          </div>
        ) : (
          <button
            onClick={addOne}
            className="absolute bottom-2 right-2 h-8 w-8 rounded-full bg-brand-green text-white text-lg flex items-center justify-center hover:bg-brand-green-dark shadow-card transition z-10"
            aria-label="Add to cart"
          >
            +
          </button>
        )
      ) : null}
    </div>
  );
}
