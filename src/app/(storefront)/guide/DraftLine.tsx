"use client";

import Link from "next/link";
import { useCart, type CartLine } from "@/lib/cart/store";
import { QtyInput } from "@/components/ui/QtyInput";
import { displayProductName } from "@/lib/utils/product-display";
import { money } from "@/lib/utils/format";
import type { Product } from "@/lib/supabase/types";
import type { GuideRow, PricedProductLite } from "./page";

/**
 * One row in the /guide draft. Four states, derived from a mix of the
 * product row (`available_this_week`) and the cart store (qty + adjusted
 * + skipped flags).
 *
 *   - SUGGESTED  : rhythm pre-filled the qty; buyer hasn't touched it.
 *                  Visual signal = brand-blue-tint pill behind the qty +
 *                  italic "Usually N" meta.
 *   - ADJUSTED   : buyer changed the qty (added, +1'd, -1'd, or typed).
 *                  Visual signal = solid brand-blue ink qty + "You set
 *                  this" meta.
 *   - SKIPPED    : rhythm row that the buyer explicitly skipped. Row
 *                  stays in the list (dimmed 50%, strikethrough qty) so
 *                  the buyer can put it back via the "Add back" pill.
 *   - STOCKOUT   : product.available_this_week === false. Qty input
 *                  replaced by inline chips ("Try X" / "Skip" / "Ask
 *                  Alex"). Substitute suggestions come from the
 *                  `substitutes` prop.
 *
 * Visual decision for SUGGESTED vs ADJUSTED: a tinted background pill on
 * the qty input. Reads at a glance — tinted-blue means autopilot, solid
 * white-with-blue-ink means buyer touched it. The italic "Usually N"
 * meta reinforces the autopilot framing in a voice that sounds like a
 * friend remembering, not a system tracking.
 */

interface Props {
  row: GuideRow;
  /** Substitute candidates for the stockout state. Pre-filtered by the
   *  page to top-2 products in the same sub_category from a different
   *  producer. Empty array = no substitutes; the chip row shows only
   *  Skip + Ask Alex. */
  substitutes?: PricedProductLite[];
}

export function DraftLine({ row, substitutes = [] }: Props) {
  const product = row.product;
  const variantKey = null; // draft lines are default-pack only for v1
  const unitPrice = row.unitPrice ?? 0;
  const inStock = product.available_this_week !== false && product.available_b2b !== false;

  const line = useCart((s) =>
    s.lines.find((l) => l.productId === product.id && (l.variantKey ?? null) === variantKey),
  );
  const adjusted = useCart((s) => s.isAdjusted(product.id, variantKey));
  const skipped = useCart((s) => s.isSkipped(product.id, variantKey));
  const rhythmQty = useCart((s) => s.rhythmQtyFor(product.id, variantKey));
  const setQty = useCart((s) => s.setQty);
  const add = useCart((s) => s.add);
  const skipLine = useCart((s) => s.skipLine);
  const addBackLine = useCart((s) => s.addBackLine);
  const markAdjusted = useCart((s) => s.markAdjusted);

  const qty = line?.quantity ?? 0;
  const isSuggested = !adjusted && rhythmQty != null && qty > 0;
  const isStockout = !inStock;
  const showSkipped = skipped && !isStockout;

  // Pack qualifier ("GALLON", "HALF GALLON", "12/6 OZ") rendered as an
  // uppercase eyebrow on the producer line. `displayProductName` strips
  // a trailing " — {pack_size}" from the name, so without this chip two
  // rows for the same producer (e.g. milk in gallon vs half-gallon) read
  // as identical — they only differ by qty pill price. Prefer pack_size
  // (consumer-facing single unit) over case_pack (B2B case spec). The
  // chip is hidden when there's nothing to disambiguate.
  const packQualifier = (product.pack_size ?? product.case_pack ?? "").trim();

  function cartLineFromProduct(quantity: number): CartLine {
    return {
      productId: product.id,
      variantKey: null,
      variantSku: null,
      sku: product.sku,
      name: product.name,
      packSize: product.pack_size,
      unit: product.unit,
      unitPrice,
      priceByWeight: Boolean(product.price_by_weight),
      quantity,
    };
  }

  function handleQtyChange(next: number) {
    if (next === qty) return;
    if (next <= 0) {
      // Zero-out via skip so the row stays visible.
      skipLine(product.id, variantKey);
      return;
    }
    if (qty === 0) {
      add(cartLineFromProduct(next));
    } else {
      setQty(product.id, next, variantKey);
    }
    markAdjusted(product.id, variantKey);
  }

  function handleAddBack() {
    const restored = rhythmQty && rhythmQty > 0 ? rhythmQty : 1;
    add(cartLineFromProduct(restored));
    addBackLine(product.id, variantKey);
  }

  function handleSwap(sub: PricedProductLite) {
    // Add the substitute, skip the original.
    const subPrice = sub.unitPrice ?? 0;
    add({
      productId: sub.id,
      variantKey: null,
      variantSku: null,
      sku: sub.sku,
      name: sub.name,
      packSize: sub.pack_size,
      unit: sub.unit,
      unitPrice: subPrice,
      priceByWeight: Boolean(sub.price_by_weight),
      quantity: rhythmQty && rhythmQty > 0 ? rhythmQty : 1,
    });
    skipLine(product.id, variantKey);
  }

  // ---- STOCKOUT row ------------------------------------------------------
  if (isStockout) {
    return (
      <div className="flex items-start gap-3 py-2.5 px-1">
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-medium text-ink-primary truncate">
            {displayProductName(product.name, product.producer, product.pack_size, product.case_pack)}
          </div>
          <div className="text-[12px] text-ink-tertiary truncate">
            {packQualifier ? (
              <span className="uppercase tracking-wide">{packQualifier}</span>
            ) : null}
            {packQualifier && product.producer ? " · " : ""}
            {product.producer ? `${product.producer} · ` : ""}Out this week
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {substitutes.slice(0, 2).map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => handleSwap(sub)}
                className="rounded-full bg-brand-blue-tint text-brand-blue text-[12px] font-medium px-2.5 py-1 hover:bg-brand-blue/15 transition-colors duration-150"
              >
                Try {sub.name.length > 24 ? `${sub.name.slice(0, 24)}…` : sub.name} <span aria-hidden>→</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => skipLine(product.id, variantKey)}
              className="rounded-full bg-bg-secondary text-ink-secondary text-[12px] font-medium px-2.5 py-1 hover:bg-black/[0.08] transition-colors duration-150"
            >
              Skip
            </button>
            <Link
              href={`/chat?sku=${encodeURIComponent(product.sku ?? product.id)}&context=${encodeURIComponent(`Stockout: ${product.name}`)}`}
              className="rounded-full bg-bg-secondary text-ink-secondary text-[12px] font-medium px-2.5 py-1 hover:bg-black/[0.08] transition-colors duration-150"
            >
              Ask Alex
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---- SKIPPED row -------------------------------------------------------
  if (showSkipped) {
    return (
      <div className="flex items-center gap-3 py-2.5 px-1 opacity-50">
        <div className="w-12 shrink-0 text-center">
          <span className="tabular text-[15px] font-semibold text-ink-tertiary line-through">
            {rhythmQty ?? 0}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] text-ink-primary truncate">
            {displayProductName(product.name, product.producer, product.pack_size, product.case_pack)}
          </div>
          <div className="text-[12px] text-ink-tertiary truncate">
            {packQualifier ? (
              <span className="uppercase tracking-wide">{packQualifier}</span>
            ) : null}
            {packQualifier && product.producer ? " · " : ""}
            {product.producer ?? ""}
          </div>
        </div>
        <button
          type="button"
          onClick={handleAddBack}
          className="shrink-0 rounded-full bg-brand-blue-tint text-brand-blue text-[12px] font-medium px-2.5 py-1 hover:bg-brand-blue/15 transition-colors duration-150 opacity-100"
        >
          + Add back
        </button>
      </div>
    );
  }

  // ---- SUGGESTED / ADJUSTED ---------------------------------------------
  // Visual treatment lives in the qty pill background. The suggested state
  // adds a hairline brand-blue border so buyers read the pill as tappable
  // — without it, the tinted-blue fill on a borderless input reads as a
  // static label.
  const qtyWrapperClass = isSuggested
    ? "h-10 w-12 rounded-md bg-brand-blue-tint border border-brand-blue/25 flex items-center justify-center"
    : "h-10 w-12";
  const qtyInputClass = isSuggested
    ? "h-10 w-12 text-center tabular text-[15px] font-semibold rounded-md bg-transparent border-none text-brand-blue-dark focus:outline-none focus:ring-2 focus:ring-brand-blue/30 transition-colors duration-150"
    : "h-10 w-12 text-center tabular text-[15px] font-semibold rounded-md border border-black/15 bg-white text-brand-blue focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30 transition-colors duration-150";

  const metaLine = isSuggested
    ? rhythmQty != null
      ? `Usually ${rhythmQty}`
      : ""
    : "You set this";

  return (
    <div className="flex items-center gap-3 py-2.5 px-1">
      <div className={`${qtyWrapperClass} shrink-0`}>
        <QtyInput
          value={qty}
          onSet={handleQtyChange}
          className={qtyInputClass}
          ariaLabel={`${product.name} quantity`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-medium text-ink-primary truncate">
          {displayProductName(product.name, product.producer, product.pack_size, product.case_pack)}
        </div>
        <div className="text-[12px] text-ink-tertiary truncate flex items-center gap-1.5">
          {packQualifier ? (
            <span className="uppercase tracking-wide shrink-0">{packQualifier}</span>
          ) : null}
          {packQualifier && product.producer ? <span aria-hidden>·</span> : null}
          {product.producer ? <span className="truncate">{product.producer}</span> : null}
          {metaLine ? (
            <>
              {(packQualifier || product.producer) ? <span aria-hidden>·</span> : null}
              <span className={isSuggested ? "italic" : "font-medium text-ink-secondary"}>
                {metaLine}
              </span>
            </>
          ) : null}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="tabular text-[13px] text-ink-secondary">
          {unitPrice > 0 ? money(unitPrice) : "—"}
        </div>
      </div>
    </div>
  );
}

/**
 * Substitute picker for a stockout row. Surfaces top-2 candidates in the
 * same sub_category from a different producer, ranked by:
 *   1. Buyer's own count over the last 90 days (signal that the buyer
 *      already trusts this swap).
 *   2. Overall order frequency (tiebreak when buyer hasn't tried either).
 *
 * Pure utility — no UI; the page consumes this to thin out candidates
 * before passing to DraftLine.
 */
export function pickSubstitutes(
  outOfStock: Product,
  candidates: PricedProductLite[],
  buyerCounts: Record<string, number>,
  globalCounts: Record<string, number>,
  limit = 2,
): PricedProductLite[] {
  const outSubCat = outOfStock.sub_category;
  const outProducer = outOfStock.producer?.trim().toLowerCase();
  const pool = candidates.filter((p) => {
    if (!p.available_this_week || p.available_b2b === false) return false;
    if (p.id === outOfStock.id) return false;
    if (p.sub_category !== outSubCat) return false;
    if (!outProducer) return true;
    return (p.producer ?? "").trim().toLowerCase() !== outProducer;
  });
  pool.sort((a, b) => {
    const aBuyer = buyerCounts[a.id] ?? 0;
    const bBuyer = buyerCounts[b.id] ?? 0;
    if (aBuyer !== bBuyer) return bBuyer - aBuyer;
    const aGlobal = globalCounts[a.id] ?? 0;
    const bGlobal = globalCounts[b.id] ?? 0;
    if (aGlobal !== bGlobal) return bGlobal - aGlobal;
    return a.name.localeCompare(b.name);
  });
  return pool.slice(0, limit);
}
