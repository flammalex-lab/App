"use client";

import Link from "next/link";
import { ProductCard, type PricedProduct } from "@/components/products/ProductCard";

/**
 * Horizontal scroll strip of vertical product cards. Replaces the older
 * 2-row column-major layout — vertical cards (image-on-top) read better,
 * each is a single snap target, and the strip scrolls more fluidly with
 * scroll-snap + smooth scroll behaviors.
 */
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
    <section className="mb-5">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="display text-base tracking-tight">
          {emoji ? <span className="mr-1">{emoji}</span> : null}
          {title}
        </h2>
        {href ? (
          <Link href={href} className="text-[13px] text-brand-blue hover:underline font-medium">
            See all →
          </Link>
        ) : null}
      </div>
      {subtitle ? (
        <p className="text-[12px] text-ink-secondary mb-2">{subtitle}</p>
      ) : null}
      <div
        className="overflow-x-auto -mx-4 md:-mx-0 px-4 md:px-0 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          // Free scroll — no snap. Snap (mandatory or proximity) was
          // hijacking momentum and felt jumpy on iOS.
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorX: "contain",
        }}
      >
        <div className="flex gap-3 min-w-max">
          {products.map((p) => (
            <div
              key={p.id}
              className="w-[44vw] max-w-[200px] min-w-[160px] shrink-0"
            >
              <ProductCard product={p} variant="compact" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
