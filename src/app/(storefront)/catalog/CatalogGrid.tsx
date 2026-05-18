"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ProductCard, type PricedProduct } from "@/components/products/ProductCard";
import { track } from "@/lib/analytics/track";
import { useScrollDepth } from "@/lib/analytics/use-scroll-depth";

export function CatalogGrid({
  products,
  fromGroup,
  inGuideIds,
  isB2B,
}: {
  products: PricedProduct[];
  fromGroup: string | null;
  /** IDs of products in the active buyer's order guide; renders the
   *  gold "In guide" badge on matching cards. */
  inGuideIds?: ReadonlySet<string>;
  /** B2B session flag — passed to each card so the client-state
   *  detail sheet knows whether to show the "Add to guide" affordance
   *  at instant-open (before the server action confirms). */
  isB2B?: boolean;
}) {
  const searchParams = useSearchParams();
  // Track a `catalog_viewed` event per (group, q, producer) tuple. Re-fires
  // on filter changes because the buyer effectively viewed a different
  // slice of the catalog.
  const group = searchParams?.get("group") ?? null;
  const q = searchParams?.get("q") ?? null;
  const producer = searchParams?.get("producer") ?? null;
  useEffect(() => {
    track("catalog_viewed", {
      group,
      q: q || null,
      producer,
      result_count: products.length,
    });
  }, [group, q, producer, products.length]);

  // Scroll depth — fires up to 4 times per filter slice (25/50/75/100%).
  // Tells us how deep buyers actually browse vs. picking only top-of-page.
  useScrollDepth("catalog_scrolled", {
    group,
    q: q || null,
    producer,
    result_count: products.length,
  });

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 px-3 md:px-0">
      {products.map((p) => (
        <ProductCard
          key={p.id}
          product={p}
          variant="grid"
          fromGroup={fromGroup}
          inGuide={inGuideIds?.has(p.id) ?? false}
          isB2B={isB2B}
        />
      ))}
    </div>
  );
}
