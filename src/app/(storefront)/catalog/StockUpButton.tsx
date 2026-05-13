"use client";

import { useState } from "react";
import type { Product } from "@/lib/supabase/types";
import { StockUpSheet } from "@/components/products/StockUpSheet";

type PricedProduct = Product & { unitPrice: number | null };

/**
 * Trigger pair: a brand-blue button that opens the StockUpSheet for the
 * current producer. Lives on `/catalog?producer=<name>` only — the server
 * page renders this when the producer has 2+ active products. Keeps the
 * catalog page a pure server component while still hosting the
 * client-only sheet.
 */
export function StockUpButton({
  producer,
  products,
}: {
  producer: string;
  products: PricedProduct[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full md:max-w-md md:mx-auto h-12 inline-flex items-center justify-center gap-2 rounded-full bg-brand-blue text-white text-[14px] font-semibold hover:bg-brand-blue-dark focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors duration-150 active:scale-[0.99] mb-4"
      >
        <span aria-hidden className="text-lg leading-none">+</span>
        Stock up on {producer}
      </button>
      <StockUpSheet
        open={open}
        onClose={() => setOpen(false)}
        producer={producer}
        products={products}
      />
    </>
  );
}
