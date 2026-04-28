"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ProductCard, type PricedProduct } from "@/components/products/ProductCard";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import type { GuideRow } from "./page";

interface Props {
  items: GuideRow[];
}

/**
 * Daily-reorder layout for the buyer's guide. List rows (full width,
 * thumb-left, name + price + stepper) instead of horizontal scroll
 * strips — chefs scanning their guide need maximum information density,
 * not big imagery. ~8-10 items per viewport on a phone.
 */
export function GuideClient({ items }: Props) {
  const [search, setSearch] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);

  const searchMatch = (r: GuideRow) =>
    !search || r.product.name.toLowerCase().includes(search.toLowerCase());

  const byProducer = useMemo(() => {
    const out = new Map<string, GuideRow[]>();
    for (const r of items) {
      const key = r.product.producer?.trim() || "_other";
      if (!out.has(key)) out.set(key, []);
      out.get(key)!.push(r);
    }
    for (const rows of out.values()) {
      rows.sort((a, b) => a.product.name.localeCompare(b.product.name));
    }
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
      <div className="mb-3">
        <div className="relative">
          <input
            type="search"
            placeholder="Search Order Guide"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pr-12"
          />
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            aria-label="Scan a barcode"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 inline-flex items-center justify-center rounded-md text-ink-secondary hover:text-ink-primary hover:bg-bg-secondary transition"
          >
            <ScanIcon />
          </button>
        </div>
      </div>

      {visibleCount === 0 ? (
        <div className="py-8 text-center text-sm text-ink-secondary">
          No items match &ldquo;{search}&rdquo;.
        </div>
      ) : (
        <div className="space-y-4">
          {byProducer.map(({ producer, rows }) => {
            const filtered = rows.filter(searchMatch);
            if (filtered.length === 0) return null;
            const label = producer === "_other" ? "Other" : producer;
            const href =
              producer === "_other"
                ? null
                : `/catalog?producer=${encodeURIComponent(producer)}`;
            const products: PricedProduct[] = filtered.map((r) => ({
              ...r.product,
              unitPrice: r.unitPrice,
            }));
            return (
              <section key={producer}>
                <div className="flex items-center justify-between mb-1.5">
                  <h2 className="text-[17px] font-semibold tracking-tight text-ink-primary leading-tight">
                    {label}
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
                <div className="md:rounded-xl md:border md:border-black/[0.06] md:bg-white md:overflow-hidden divide-y divide-black/[0.06]">
                  {products.map((p) => (
                    <ProductCard key={p.id} product={p} variant="row" />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        mode="cart"
      />
    </>
  );
}

function ScanIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7V5a1 1 0 0 1 1-1h2" />
      <path d="M17 4h2a1 1 0 0 1 1 1v2" />
      <path d="M20 17v2a1 1 0 0 1-1 1h-2" />
      <path d="M7 20H5a1 1 0 0 1-1-1v-2" />
      <path d="M7 9v6M11 9v6M15 9v6" />
    </svg>
  );
}
