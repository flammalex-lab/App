"use client";

import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/lib/supabase/types";
import { useCart } from "@/lib/cart/store";
import { productImage } from "@/lib/utils/product-image";
import { money } from "@/lib/utils/format";

type PricedProduct = Product & { unitPrice: number | null };

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
  const [qty, setQty] = useState(0);
  const [justAdded, setJustAdded] = useState(false);
  const add = useCart((s) => s.add);
  const cartQty = useCart((s) =>
    s.lines.find((l) => l.productId === product.id)?.quantity ?? 0,
  );
  const available = product.available_this_week && product.unitPrice != null;

  const detailHref = fromGroup
    ? `/catalog/${product.id}?from=${fromGroup}`
    : `/catalog/${product.id}`;

  function doAdd(n: number) {
    if (!available || n <= 0) return;
    add({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      packSize: product.pack_size,
      unit: product.unit,
      unitPrice: product.unitPrice!,
      quantity: n,
    });
    setQty(0);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  }

  return (
    <div className="card overflow-hidden flex flex-col group">
      {/* Image with name overlaid */}
      <Link href={detailHref} className="relative block aspect-square bg-bg-secondary">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={productImage(product)}
          alt={product.name}
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
          {product.producer ? (
            <div className="text-white/80 text-[10px] mt-0.5 line-clamp-1">
              {product.producer}
            </div>
          ) : null}
        </div>
        {!product.available_this_week ? (
          <span className="absolute top-2 right-2 badge-gray bg-white/90">limited</span>
        ) : null}
      </Link>

      {/* Price + qty controls */}
      <div className="p-2.5 flex items-center justify-between gap-2 border-t border-black/5">
        <div className="min-w-0">
          <div className="mono font-semibold text-sm">
            {product.unitPrice != null ? money(product.unitPrice) : "—"}
          </div>
          <div className="text-[10px] text-ink-tertiary uppercase">/ {product.unit}</div>
        </div>
        {available ? (
          qty > 0 ? (
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setQty(Math.max(0, qty - 1))}
                className="h-8 w-8 rounded-full border border-black/10 flex items-center justify-center text-sm"
                aria-label="Decrement"
              >
                −
              </button>
              <span className="mono font-semibold w-6 text-center text-sm">{qty}</span>
              <button
                onClick={() => doAdd(qty)}
                className="h-8 px-2.5 rounded-full bg-brand-blue text-white text-xs font-medium"
              >
                Add
              </button>
            </div>
          ) : justAdded ? (
            <div className="text-xs font-medium text-brand-green">
              ✓ In cart ({cartQty})
            </div>
          ) : (
            <button
              onClick={() => setQty(1)}
              className="h-8 px-3 rounded-full bg-brand-blue text-white text-xs font-medium hover:bg-brand-blue-dark transition"
            >
              + Add
            </button>
          )
        ) : (
          <span className="text-xs text-ink-tertiary">—</span>
        )}
      </div>
    </div>
  );
}
