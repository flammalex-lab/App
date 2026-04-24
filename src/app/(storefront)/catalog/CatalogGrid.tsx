"use client";

import { ProductCard, type PricedProduct } from "@/components/products/ProductCard";

export function CatalogGrid({
  products,
  fromGroup,
}: {
  products: PricedProduct[];
  fromGroup: string | null;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 px-3 md:px-0">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} variant="grid" fromGroup={fromGroup} />
      ))}
    </div>
  );
}
