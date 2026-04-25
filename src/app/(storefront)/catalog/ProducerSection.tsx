"use client";

import Link from "next/link";
import { ProductCard, type PricedProduct } from "@/components/products/ProductCard";

/**
 * Vertical list of full-width product rows under a producer header.
 * Replaces the horizontal scroll-strip layout for category-by-producer
 * browsing — list rows are denser to scan and keep the qty stepper at
 * the right edge near the user's thumb.
 */
export function ProducerSection({
  producer,
  products,
  fromGroup,
}: {
  producer: string | null;
  products: PricedProduct[];
  fromGroup?: string | null;
}) {
  if (products.length === 0) return null;
  const label = producer ?? "Other";
  const href = producer
    ? `/catalog?producer=${encodeURIComponent(producer)}`
    : undefined;

  return (
    <section className="mb-3">
      <div className="flex items-baseline justify-between px-3 md:px-0 mb-1">
        <h2 className="display text-[18px] font-bold tracking-tight text-ink-primary">{label}</h2>
        {href ? (
          <Link
            href={href}
            className="text-[13px] text-brand-blue hover:underline font-medium"
          >
            See all →
          </Link>
        ) : null}
      </div>
      <div className="md:rounded-xl md:border md:border-black/10 md:bg-white md:overflow-hidden divide-y divide-black/[0.06]">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            variant="row"
            fromGroup={fromGroup ?? undefined}
          />
        ))}
      </div>
    </section>
  );
}
