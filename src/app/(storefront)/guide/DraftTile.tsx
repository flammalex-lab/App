"use client";

import { useCart, type CartLine } from "@/lib/cart/store";
import { QtyInput } from "@/components/ui/QtyInput";
import { displayProductName } from "@/lib/utils/product-display";
import { productPhoto } from "@/lib/utils/product-image";
import { useProductSheet } from "@/lib/products/detail-sheet-store";
import {
  ProductThumb,
  PriceLine,
} from "@/components/products/primitives";
import type { GuideRow } from "./page";

/**
 * Condensed draft tile — used by DraftStrip to pack the rhythm-suggested
 * lines into a horizontal-scroll grid. Three visual states, mirroring
 * DraftLine's:
 *
 *   - SUGGESTED  : rhythm pre-filled qty. Tinted blue pill behind the qty.
 *   - ADJUSTED   : buyer changed qty. White pill, blue ink.
 *   - SKIPPED    : tile dimmed + strikethrough name; the qty pill becomes
 *                  a gold-tint "+ back" button that restores rhythm qty.
 *
 * STOCKOUT is NOT rendered here — substitute chips don't fit on a 100px
 * tile. The parent (DraftStrip's caller in GuideClient) splits out
 * stockout rows and renders them as the existing fullwidth DraftLine.
 *
 * Tap targets:
 *   - Tap qty pill   → focus QtyInput (numeric keyboard) / restore (skipped)
 *   - Tap tile body  → open the product detail sheet
 */
export function DraftTile({ row }: { row: GuideRow }) {
  const product = row.product;
  const variantKey = null;
  const unitPrice = row.unitPrice ?? 0;

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

  const photo = productPhoto(product);
  const displayName = displayProductName(
    product.name,
    product.producer,
    product.pack_size,
    product.case_pack,
  );

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

  function openDetail() {
    useProductSheet.getState().open(product, { packs: row.packs });
  }

  // Qty pill — visual states encoded on the wrapper background.
  const pillWrapClass = skipped
    ? "h-7 px-2 rounded-md bg-accent-gold/15 text-[#8a690f] flex items-center gap-1 text-[11px] font-semibold tabular shrink-0"
    : isSuggested
      ? "h-7 w-10 rounded-md bg-brand-blue-tint border border-brand-blue/25 flex items-center justify-center shrink-0"
      : "h-7 w-10 rounded-md border border-black/15 bg-white flex items-center justify-center shrink-0";
  const inputClass = isSuggested
    ? "h-7 w-10 text-center tabular text-[12px] font-semibold rounded-md bg-transparent border-none text-brand-blue-dark focus:outline-none"
    : "h-7 w-10 text-center tabular text-[12px] font-semibold rounded-md bg-transparent border-none text-brand-blue focus:outline-none";

  return (
    <div className={`relative flex flex-col snap-start ${skipped ? "opacity-50" : ""}`}>
      <button
        type="button"
        onClick={openDetail}
        aria-label={product.name}
        className="absolute inset-0 z-0 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
      />

      <div className="relative pointer-events-none">
        <ProductThumb product={product} photo={photo} sizePx={96} className="rounded-md" />
      </div>

      <div
        className={`pt-1.5 text-[11px] font-semibold leading-snug text-ink-primary line-clamp-2 pointer-events-none ${
          skipped ? "line-through text-ink-tertiary" : ""
        }`}
        title={product.name}
      >
        {displayName}
      </div>

      <div className="mt-1 flex items-center gap-1.5 relative">
        {skipped ? (
          <button
            type="button"
            onClick={handleAddBack}
            className={pillWrapClass}
            aria-label={`Add back ${product.name}`}
          >
            <span aria-hidden>+</span>
            <span className="line-through tabular">{rhythmQty ?? 0}</span>
          </button>
        ) : (
          <div className={pillWrapClass}>
            <QtyInput
              value={qty}
              onSet={handleQtyChange}
              ariaLabel={`${product.name} quantity`}
              className={inputClass}
            />
          </div>
        )}
        <PriceLine
          price={unitPrice > 0 ? unitPrice : null}
          textSize="xs"
          weight="medium"
          className="truncate pointer-events-none"
        />
      </div>
    </div>
  );
}
