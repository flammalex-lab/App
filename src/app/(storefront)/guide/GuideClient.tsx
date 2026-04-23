"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/lib/supabase/types";
import { ScrollStrip } from "@/app/(storefront)/catalog/ScrollStrip";
import type { GuideRow } from "./page";

interface Props {
  items: GuideRow[];
}

type PricedProduct = Product & { unitPrice: number | null };

export function GuideClient({ items }: Props) {
  const [search, setSearch] = useState("");

  const searchMatch = (r: GuideRow) =>
    !search || r.product.name.toLowerCase().includes(search.toLowerCase());

  // Group items by producer. Alphabetical within producers, producers with
  // no name fall into "Other" at the end.
  const byProducer = useMemo(() => {
    const out = new Map<string, GuideRow[]>();
    for (const r of items) {
      const key = r.product.producer?.trim() || "_other";
      if (!out.has(key)) out.set(key, []);
      out.get(key)!.push(r);
    }
    // Sort each producer's items by name for stable order.
    for (const rows of out.values()) {
      rows.sort((a, b) => a.product.name.localeCompare(b.product.name));
    }
    // Producers sorted alphabetically, "_other" last.
    const producers = Array.from(out.keys()).sort((a, b) => {
      if (a === "_other") return 1;
      if (b === "_other") return -1;
      return a.localeCompare(b);
    });
    return producers.map((p) => ({ producer: p, rows: out.get(p)! }));
  }, [items]);

  const visibleCount = items.filter(searchMatch).length;

  return (
    <>
      <div className="px-4 md:px-0 mb-3">
        <input
          type="search"
          placeholder="Search your guide"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input"
        />
      </div>

      {visibleCount === 0 ? (
        <div className="px-4 md:px-0 py-8 text-center text-sm text-ink-secondary">
          No items match &ldquo;{search}&rdquo;.
        </div>
      ) : (
        byProducer.map(({ producer, rows }) => {
          const filtered = rows.filter(searchMatch);
          if (filtered.length === 0) return null;
          const label = producer === "_other" ? "Other" : producer;
          const products: PricedProduct[] = filtered.map((r) => ({
            ...r.product,
            unitPrice: r.unitPrice,
          }));
          return (
            <ScrollStrip
              key={producer}
              title={label}
              href={
                producer === "_other"
                  ? undefined
                  : `/catalog?producer=${encodeURIComponent(producer)}`
              }
              products={products}
            />
          );
        })
      )}
    </>
  );
}
