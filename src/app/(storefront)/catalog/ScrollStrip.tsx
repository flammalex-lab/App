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
  density = "default",
}: {
  title: string;
  href?: string;
  subtitle?: string;
  products: PricedProduct[];
  emoji?: string;
  /** "dense" packs more cards per viewport — used on the Guide where
   *  buyers scan known items quickly. "default" is the catalog feel. */
  density?: "default" | "dense";
}) {
  if (products.length === 0) return null;

  const cardWidth =
    density === "dense"
      ? "w-[30vw] max-w-[130px] min-w-[110px]"
      : "w-[40vw] max-w-[170px] min-w-[140px]";

  return (
    <section className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[17px] font-semibold tracking-tight text-ink-primary leading-tight">
          {emoji ? <span className="mr-1">{emoji}</span> : null}
          {title}
        </h2>
        {href ? (
          <Link
            href={href}
            className="inline-flex items-center gap-0.5 text-[13px] font-medium text-ink-secondary hover:text-ink-primary transition-colors duration-150"
          >
            See all
            <span aria-hidden className="text-base leading-none">›</span>
          </Link>
        ) : null}
      </div>
      {subtitle ? (
        <p className="text-[13px] text-ink-secondary mb-2">{subtitle}</p>
      ) : null}
      <div
        className="overflow-x-auto -mx-4 md:-mx-0 px-4 md:px-0 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorX: "contain",
        }}
      >
        <div className="flex gap-3 min-w-max">
          {products.map((p) => (
            <div key={p.id} className={`${cardWidth} shrink-0`}>
              <ProductCard product={p} variant="compact" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
