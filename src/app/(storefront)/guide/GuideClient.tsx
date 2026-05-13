"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Product } from "@/lib/supabase/types";
import { ScrollStrip } from "@/app/(storefront)/catalog/ScrollStrip";
import { groupBySubCategory } from "@/lib/products/sub-category";
import { EmptyState } from "@/components/ui/EmptyState";
import type { GuideRow, PricedProductLite } from "./page";

// See CatalogSearchInput for rationale — dynamic-import keeps the
// camera-modal + @zxing libs out of the guide's initial JS bundle.
const BarcodeScanner = dynamic(
  () => import("@/components/BarcodeScanner").then((m) => m.BarcodeScanner),
  { ssr: false },
);

interface Props {
  items: GuideRow[];
  /** Kept for compatibility with the page's existing data fetch; no
   *  longer used now that strips are sub-category-driven (matches the
   *  catalog category-browse layout shipped in PR #46). */
  buyerProducerRank?: Record<string, number>;
  globalProducerRank?: Record<string, number>;
  /** Products from producers this buyer already orders from, that the
   *  buyer has never personally ordered. Renders as a discovery strip
   *  at the bottom of /guide. Empty array hides the strip entirely. */
  newFromProducers?: PricedProductLite[];
  /** SmartShop: distinct products the buyer (or anyone on their active
   *  account) committed to in the last 21 days, ranked by how many
   *  distinct orders they appeared in. Capped at 12. Empty array hides
   *  the strip entirely — no empty-state copy. */
  recentBuys?: PricedProductLite[];
  /** IDs of products in the buyer's default order guide. Powers the
   *  gold "In guide" badge on discovery + SmartShop strip cards. */
  inGuideIds?: string[];
}

type PricedProduct = Product & { unitPrice: number | null };

export function GuideClient({
  items,
  newFromProducers = [],
  recentBuys = [],
  inGuideIds = [],
}: Props) {
  const [search, setSearch] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);

  const searchMatch = (r: GuideRow) =>
    !search || r.product.name.toLowerCase().includes(search.toLowerCase());

  // Group the buyer's guide by sub-category instead of producer. Same
  // helper the /catalog category-browse uses, so the visual structure
  // (Milk / Eggs / Yogurt rows within Dairy; Beef / Pork / Chicken
  // within Meat) is consistent across the buyer's surfaces.
  const subCategorySections = useMemo(() => {
    const lite = items.map((r) => ({ id: r.product.id, row: r, name: r.product.name, category: r.product.category }));
    const groups = groupBySubCategory(lite);
    return groups.map((g) => ({
      subCategory: g.subCategory,
      rows: g.items.map((it) => it.row).sort((a, b) =>
        a.product.name.localeCompare(b.product.name),
      ),
    }));
  }, [items]);

  const visibleCount = items.filter(searchMatch).length;

  // ReadonlySet for fast badge lookups inside ScrollStrip. Memoised so the
  // prop reference is stable across renders.
  const inGuideSet = useMemo(() => new Set(inGuideIds), [inGuideIds]);

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
        <EmptyState
          title={<>No items match &ldquo;{search}&rdquo;.</>}
          body="Try a broader search or browse the full catalog."
          cta={{ href: "/catalog", label: "Browse catalog" }}
        />
      ) : (
        <>
          {/* SmartShop: products the buyer (or their account) committed to
              in the last 21 days, ranked by order frequency. The strip
              itself IS the surface — no See-all. Hidden during search
              (focused intent) and when empty. */}
          {!search && recentBuys.length > 0 ? (
            <ScrollStrip
              title="Recent buys"
              products={recentBuys}
              density="dense"
              inGuideIds={inGuideSet}
            />
          ) : null}

          {subCategorySections.map(({ subCategory, rows }) => {
            const filtered = rows.filter(searchMatch);
            if (filtered.length === 0) return null;
            const products: PricedProduct[] = filtered.map((r) => ({
              ...r.product,
              unitPrice: r.unitPrice,
            }));
            // "See all" expands from the buyer's guide-scoped subset to the
            // catalog's full inventory in the parent group (e.g. Dairy).
            // We don't have a per-subcategory URL filter, so the parent
            // group is the closest meaningful target.
            const parentGroup = filtered[0]?.product.category ?? null;
            const seeAllHref = parentGroup
              ? `/catalog?group=${parentGroup}`
              : undefined;
            return (
              <ScrollStrip
                key={subCategory}
                title={subCategory}
                href={seeAllHref}
                products={products}
                density="dense"
              />
            );
          })}

          {/* Discovery: products from producers this buyer already orders
              from, but they've never tried this specific product. Hidden
              while searching — search is a focused intent state. */}
          {!search && newFromProducers.length > 0 ? (
            <ScrollStrip
              title="New from your producers"
              products={newFromProducers}
              density="dense"
              inGuideIds={inGuideSet}
            />
          ) : null}
        </>
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
