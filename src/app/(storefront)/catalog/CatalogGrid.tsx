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

  function decrement() {
    setQty(product.id, Math.max(0, cartQty - 1), null);
  }

  return (
    <div className="card relative overflow-hidden flex flex-col group">
      {/* Stub link covers the whole card. Everything else sits on top with
          pointer-events disabled, except specific interactive bits that
          opt back in (producer link, cart buttons). */}
      <Link
        href={detailHref}
        aria-label={product.name}
        className="absolute inset-0 z-0"
      />

      <div className="relative aspect-square bg-bg-secondary pointer-events-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={productImage(product)}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
        <div className="absolute inset-x-0 top-0 p-2.5">
          <div
            className="text-white font-semibold leading-tight drop-shadow-sm text-sm sm:text-base line-clamp-2"
            title={product.name}
          >
            {product.name}
          </div>
          {product.producer && producerHref ? (
            <Link
              href={producerHref}
              className="mt-0.5 inline-block max-w-full truncate text-white/85 text-[10px] pointer-events-auto hover:underline hover:text-white transition"
            >
              {product.producer}
            </Link>
          ) : null}
        </div>
        {!product.available_this_week ? (
          <span className="absolute top-2 right-2 badge-gray bg-white/90">limited</span>
        ) : null}
        {isRecent(product.created_at) ? (
          <span className="absolute top-2 left-2 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide rounded bg-accent-gold text-white shadow-sm">
            New
          </span>
        ) : null}
      </div>

      <div className="relative p-2.5 flex items-center justify-between gap-2 border-t border-black/5 pointer-events-none">
        <div className="min-w-0">
          <div className="tabular font-semibold text-sm">
            {product.unitPrice != null ? money(product.unitPrice) : "—"}
          </div>
          <div className="text-[10px] text-ink-tertiary uppercase">/ {product.unit}</div>
        </div>
        <div className="pointer-events-auto">
          {available ? (
            cartQty > 0 ? (
              <div className="flex items-center gap-0.5">
                <button
                  onClick={decrement}
                  className="h-8 w-8 rounded-full border border-black/10 flex items-center justify-center text-sm hover:bg-bg-secondary"
                  aria-label="Remove one"
                >
                  {cartQty === 1 ? "🗑" : "−"}
                </button>
                <span className="tabular font-semibold w-6 text-center text-sm">{cartQty}</span>
                <button
                  onClick={addOne}
                  className="h-8 w-8 rounded-full bg-brand-green text-white text-sm font-medium hover:bg-brand-green-dark transition flex items-center justify-center"
                  aria-label="Add one"
                >
                  +
                </button>
              </div>
            ) : (
              <button
                onClick={addOne}
                className="h-9 w-9 rounded-full bg-brand-green text-white text-lg font-medium hover:bg-brand-green-dark transition flex items-center justify-center"
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
    </div>
  );
}
