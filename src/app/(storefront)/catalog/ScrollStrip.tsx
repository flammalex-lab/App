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
      <div className="flex gap-3 overflow-x-auto px-4 md:px-0 pb-2 snap-x">
        {products.map((p) => (
          <CompactCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}

/**
 * Compact list-style card — thumb on the left, product info on the right.
 * Used in the first-click scroll strips on /guide and /catalog to pack
 * more items onto the landing. The larger portrait card (CatalogGrid's
 * ProductCard) shows up when the buyer clicks "See all" into a filtered
 * producer or group view.
 */
function CompactCard({ product }: { product: PricedProduct }) {
  const add = useCart((s) => s.add);
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

  return (
    <div className="shrink-0 w-[240px] snap-start relative rounded-xl border border-black/[0.06] bg-bg-primary overflow-hidden transition hover:border-black/10 hover:shadow-[0_2px_10px_rgba(22,22,22,0.05)]">
      {/* Stub link covers the whole card; producer + cart button opt back in. */}
      <Link href={detailHref} aria-label={product.name} className="absolute inset-0 z-0" />

      <div className="relative flex gap-3 p-2.5">
        {/* Thumbnail */}
        <div className="relative h-[76px] w-[76px] shrink-0 rounded-lg overflow-hidden bg-bg-secondary flex items-center justify-center pointer-events-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={productImage(product)}
            alt=""
            className="max-h-full max-w-full object-contain mix-blend-multiply"
          />
          {cartQty > 0 ? (
            <span className="absolute top-0.5 left-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent-gold text-white text-[10px] font-semibold flex items-center justify-center tabular shadow-sm">
              {cartQty}
            </span>
          ) : null}
          {available ? (
            <button
              onClick={addOne}
              className="absolute bottom-0.5 right-0.5 h-6 w-6 rounded-full bg-brand-green-dark text-white text-sm leading-none flex items-center justify-center hover:bg-brand-green-dark/90 transition shadow-sm pointer-events-auto"
              aria-label="Add to cart"
            >
              +
            </button>
          ) : null}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 pointer-events-none">
          {product.producer && producerHref ? (
            <Link
              href={producerHref}
              className="block max-w-full truncate text-[10px] font-medium uppercase tracking-wider text-brand-green-dark hover:underline pointer-events-auto"
            >
              {product.producer}
            </Link>
          ) : null}
          <div className="display text-[13px] font-semibold leading-snug text-ink-primary line-clamp-2">
            {product.name}
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="tabular text-[13px] font-semibold text-ink-primary">
              {product.unitPrice != null ? money(product.unitPrice) : "—"}
            </span>
            <span className="text-[10px] text-ink-tertiary uppercase">
              / {product.pack_size ?? product.unit}
            </span>
          </div>
          {!available ? (
            <span className="inline-block mt-1 badge-gray text-[9px]">limited</span>
          ) : isRecent(product.created_at) ? (
            <span className="inline-block mt-1 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide rounded bg-accent-gold text-white">
              New
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
