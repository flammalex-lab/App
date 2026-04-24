"use client";

import Link from "next/link";
import { ProductCard, type PricedProduct } from "@/components/products/ProductCard";

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
              <ProductCard product={product} variant="compact" />
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
