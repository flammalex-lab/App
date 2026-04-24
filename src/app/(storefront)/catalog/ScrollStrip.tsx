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

  // Pack products into two rows by splitting in half. Within each row
  // products are ordered left→right, top row first then bottom, so
  // scrolling horizontally reveals the next pair together.
  const rows = layoutTwoRows(products);

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
      <div className="overflow-x-auto px-4 md:px-0 pb-1 snap-x">
        <div
          className="grid grid-flow-col auto-cols-[200px] gap-x-2 gap-y-2"
          style={{ gridTemplateRows: rows.rowCount === 2 ? "1fr 1fr" : "1fr" }}
        >
          {rows.items.map(({ product, row }) => (
            <div key={product.id} className="snap-start" style={{ gridRow: row }}>
              <CompactCard product={product} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Split the products list into two rows when there are more than 2.
 * Column-major fill so scrolling shows pairs (A/B) together, then (C/D), etc.
 */
function layoutTwoRows(products: readonly PricedProduct[]) {
  if (products.length <= 2) {
    return {
      rowCount: 1,
      items: products.map((product) => ({ product, row: 1 as 1 | 2 })),
    };
  }
  const halfUp = Math.ceil(products.length / 2);
  const items: { product: PricedProduct; row: 1 | 2 }[] = [];
  for (let col = 0; col < halfUp; col++) {
    const top = products[col];
    const bot = products[col + halfUp];
    if (top) items.push({ product: top, row: 1 });
    if (bot) items.push({ product: bot, row: 2 });
  }
  return { rowCount: 2, items };
}

/**
 * Dense list-style card — small thumb on the left, tight info on the right.
 * Whole card opens the product modal via the stub Link. Specific interactive
 * bits (the +/stepper) opt back in with pointer-events-auto.
 */
function CompactCard({ product }: { product: PricedProduct }) {
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const cartQty = useCart(
    (s) =>
      s.lines.find((l) => l.productId === product.id && l.variantKey === null)?.quantity ?? 0,
  );
  const available = product.available_this_week && product.unitPrice != null;
  const detailHref = `/catalog/${product.id}`;

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

  const richSize = product.case_pack ?? product.pack_size;
  const sizeLabel = richSize ?? product.unit;
  const sep = richSize ? "·" : "/";

  return (
    <div className="w-full h-full relative rounded-lg border border-black/[0.06] bg-bg-primary overflow-hidden transition hover:border-black/10">
      {/* Stub link — THE click target for the whole card (opens product modal). */}
      <Link href={detailHref} aria-label={product.name} className="absolute inset-0 z-0" />

      {/* Content is marked pointer-events-none so clicks pass through to the
          stub Link above. Specific interactive bits opt back in. */}
      <div className="relative flex gap-2 p-1.5 pointer-events-none">
        <div className="relative h-12 w-12 shrink-0 rounded-md overflow-hidden bg-bg-secondary flex items-center justify-center">
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
          <div className="mt-0.5 flex items-center justify-between gap-1">
            <div className="min-w-0 truncate">
              <span className="tabular text-[12px] font-semibold text-ink-primary">
                {product.unitPrice != null ? money(product.unitPrice) : "—"}
              </span>
              <span className="text-[9px] text-ink-tertiary uppercase ml-1">
                {sep} {sizeLabel}
              </span>
            </div>
            {available ? (
              cartQty > 0 ? (
                <div className="flex items-center gap-0 shrink-0 pointer-events-auto">
                  <button
                    onClick={sub}
                    className="h-5 w-5 rounded-full flex items-center justify-center text-brand-green-dark hover:bg-brand-green-tint transition"
                    aria-label={cartQty === 1 ? "Remove from cart" : "Remove one"}
                  >
                    {cartQty === 1 ? <TrashIcon /> : <span className="text-xs leading-none">−</span>}
                  </button>
                  <span className="tabular text-[10px] font-semibold w-3 text-center">{cartQty}</span>
                  <button
                    onClick={addOne}
                    className="h-5 w-5 rounded-full bg-brand-green-dark text-white flex items-center justify-center text-xs leading-none hover:bg-brand-green-dark/90 transition"
                    aria-label="Add one"
                  >
                    +
                  </button>
                </div>
              ) : (
                <button
                  onClick={addOne}
                  className="h-5 w-5 rounded-full bg-brand-green-dark text-white flex items-center justify-center text-xs leading-none hover:bg-brand-green-dark/90 transition shrink-0 pointer-events-auto"
                  aria-label="Add to cart"
                >
                  +
                </button>
              )
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
