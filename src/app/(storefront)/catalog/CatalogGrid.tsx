"use client";

import { ProductCard, type PricedProduct } from "@/components/products/ProductCard";

export function CatalogGrid({
  products,
  fromGroup,
  inGuideIds,
}: {
  products: PricedProduct[];
  fromGroup: string | null;
  /** IDs of products in the active buyer's order guide; renders the
   *  gold "In guide" badge on matching cards. */
  inGuideIds?: ReadonlySet<string>;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 px-3 md:px-0">
      {products.map((p) => (
        <ProductCard
          key={p.id}
          product={p}
          variant="grid"
          fromGroup={fromGroup}
          inGuide={inGuideIds?.has(p.id) ?? false}
        />
      ))}
    </div>
  );
}
