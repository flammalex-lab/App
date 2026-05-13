"use client";

import { useState } from "react";
import type { Product } from "@/lib/supabase/types";
import { StockUpSheet } from "@/components/products/StockUpSheet";

type PricedProduct = Product & { unitPrice: number | null };

/**
 * Trigger pair: a brand-blue button that opens the StockUpSheet for the
 * current subject (a producer on `/catalog?producer=X`, a sub-category
 * on `/catalog?group=X&subCategory=Y`). The server page renders this
 * when the assortment has 2+ products. Keeps the catalog page a pure
 * server component while still hosting the client-only sheet.
 */
export function StockUpButton({
  subject,
  products,
}: {
  subject: string;
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
        Stock up on {subject}
      </button>
      <StockUpSheet
        open={open}
        onClose={() => setOpen(false)}
        subject={subject}
        products={products}
      />
    </>
  );
}
