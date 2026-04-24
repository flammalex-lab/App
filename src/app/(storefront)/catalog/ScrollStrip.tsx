"use client";

import Link from "next/link";
import type { Product } from "@/lib/supabase/types";
import { useCart } from "@/lib/cart/store";
import { productImage } from "@/lib/utils/product-image";
import { money } from "@/lib/utils/format";

type PricedProduct = Product & { unitPrice: number | null };

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
    <section className="mb-4">
      <div className="flex items-baseline justify-between px-4 md:px-0 mb-1">
        <h2 className="display text-base tracking-tight">
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
        <p className="text-[11px] text-ink-secondary px-4 md:px-0 mb-1">{subtitle}</p>
      ) : null}
      <div className="flex gap-2 overflow-x-auto px-4 md:px-0 pb-1 snap-x">
        {products.map((p) => (
          <CompactCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}

function CompactCard({ product }: { product: PricedProduct }) {
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const cartQty = useCart(
    (s) =>
      s.lines.find((l) => l.productId === product.id && l.variantKey === null)?.quantity ?? 0,
  );
  const available = product.available_this_week && product.unitPrice != null;
  const detailHref = `/catalog/${product.id}`;

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

  // Separator: use middot when pack_size is present (avoids ugly "/8/5 OZ"),
  // keep slash when we only have the unit like "lb".
  const hasPackSize = Boolean(product.pack_size);
  const sizeLabel = product.pack_size ?? product.unit;

  return (
    <div className="shrink-0 w-[180px] snap-start relative rounded-lg border border-black/[0.06] bg-bg-primary overflow-hidden transition hover:border-black/10">
      <Link href={detailHref} aria-label={product.name} className="absolute inset-0 z-0" />

      <div className="relative flex gap-2 p-1.5">
        <div className="relative h-14 w-14 shrink-0 rounded-md overflow-hidden bg-bg-secondary flex items-center justify-center pointer-events-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={productImage(product)}
            alt=""
            className="max-h-full max-w-full object-contain mix-blend-multiply"
          />
          {cartQty > 0 ? (
            <span className="absolute top-0 left-0 min-w-[16px] h-[16px] px-1 rounded-br-md bg-accent-gold text-white text-[9px] font-semibold flex items-center justify-center tabular">
              {cartQty}
            </span>
          ) : null}
        </div>

        <div className="flex-1 min-w-0 pr-[52px] pointer-events-none">
          <div className="display text-[12px] font-semibold leading-tight text-ink-primary line-clamp-2">
            {product.name}
          </div>
          <div className="mt-0.5 flex items-baseline gap-1 truncate">
            <span className="tabular text-[12px] font-semibold text-ink-primary">
              {product.unitPrice != null ? money(product.unitPrice) : "—"}
            </span>
            <span className="text-[9px] text-ink-tertiary uppercase truncate">
              {hasPackSize ? `· ${sizeLabel}` : `/${sizeLabel}`}
            </span>
          </div>
        </div>

        {/* Cart controls anchored bottom-right. Shrinks to a stepper when in cart. */}
        {available ? (
          cartQty > 0 ? (
            <div className="absolute bottom-1 right-1 flex items-center gap-0 bg-bg-primary rounded-full border border-black/10 shadow-sm pointer-events-auto">
              <button
                onClick={sub}
                className="h-6 w-6 rounded-full flex items-center justify-center text-brand-green-dark hover:bg-brand-green-tint transition"
                aria-label={cartQty === 1 ? "Remove from cart" : "Remove one"}
              >
                {cartQty === 1 ? <TrashIcon /> : <span className="text-sm leading-none">−</span>}
              </button>
              <span className="tabular text-[11px] font-semibold w-4 text-center">{cartQty}</span>
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
              className="absolute bottom-1 right-1 h-6 w-6 rounded-full bg-brand-green-dark text-white text-sm leading-none flex items-center justify-center hover:bg-brand-green-dark/90 transition pointer-events-auto"
              aria-label="Add to cart"
            >
              +
            </button>
          )
        ) : null}
      </div>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
