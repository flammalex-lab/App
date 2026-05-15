"use client";

import { useCart, type CartLine } from "@/lib/cart/store";
import { QtyInput } from "@/components/ui/QtyInput";
import { displayProductName } from "@/lib/utils/product-display";
import { productPhoto } from "@/lib/utils/product-image";
import { useProductSheet } from "@/lib/products/detail-sheet-store";
import { money } from "@/lib/utils/format";
import { ProductThumb, haptic } from "@/components/products/primitives";
import type { GuideRow } from "./page";

/**
 * Condensed draft tile — used by DraftStrip to pack the rhythm-suggested
 * lines into a horizontal-scroll grid. Three visual states, mirroring
 * DraftLine's:
 *
 *   - SUGGESTED  : rhythm pre-filled qty. Qty cell tinted-blue.
 *   - ADJUSTED   : buyer changed qty. Qty cell white, blue ink.
 *   - SKIPPED    : tile dimmed + strikethrough name; the stepper is
 *                  replaced by a single full-width "+ back" button that
 *                  restores rhythm qty.
 *
 * STOCKOUT is NOT rendered here — substitute chips don't fit on a 96px
 * tile. The parent (DraftStrip's caller in GuideClient) splits out
 * stockout rows and renders them as the existing fullwidth DraftLine.
 *
 * Layout: 96px wide. Image 96×96 with a small price-pill overlay in
 * the top-right corner (so the unit price stays visible without taking
 * a separate text row). Below: name (2-line clamp). Below: [−][N][+]
 * stepper, 28px buttons, exact 96px total width — no gaps, qty cell
 * 40px wide. Tap targets are below the 44px iOS HIG, but the buyer-
 * frequent-use context (chefs editing their daily rhythm) makes the
 * density trade worth it; the QtyInput itself remains tappable for
 * direct numeric entry when the +/- doesn't suffice.
 *
 * Tap targets:
 *   - −/+      → bump qty by one (capped at 0)
 *   - qty cell → focus QtyInput (numeric keyboard)
 *   - tile body→ open the product detail sheet
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

  function bumpUp() {
    haptic(8);
    handleQtyChange(qty + 1);
  }
  function bumpDown() {
    haptic(6);
    handleQtyChange(Math.max(0, qty - 1));
  }

  function handleAddBack() {
    const restored = rhythmQty && rhythmQty > 0 ? rhythmQty : 1;
    add(cartLineFromProduct(restored));
    addBackLine(product.id, variantKey);
  }

  function openDetail() {
    useProductSheet.getState().open(product, { packs: row.packs });
  }

  // Qty cell background encodes the suggested/adjusted distinction.
  const qtyCellClass = isSuggested
    ? "h-7 w-10 flex items-center justify-center bg-brand-blue-tint border-y border-brand-blue/25"
    : "h-7 w-10 flex items-center justify-center bg-white border-y border-black/15";
  const qtyInputClass = isSuggested
    ? "h-7 w-10 text-center tabular text-[12px] font-semibold bg-transparent border-none text-brand-blue-dark focus:outline-none"
    : "h-7 w-10 text-center tabular text-[12px] font-semibold bg-transparent border-none text-brand-blue focus:outline-none";

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
        {unitPrice > 0 ? (
          <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-semibold tabular bg-white/95 text-ink-primary shadow-card">
            {money(unitPrice)}
          </span>
        ) : null}
      </div>

      <div
        className={`pt-1.5 px-0.5 text-[11px] font-semibold leading-snug text-ink-primary line-clamp-2 pointer-events-none ${
          skipped ? "line-through text-ink-tertiary" : ""
        }`}
        title={product.name}
      >
        {displayName}
      </div>

      <div className="mt-1 relative">
        {skipped ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleAddBack();
            }}
            className="w-full h-7 inline-flex items-center justify-center gap-1 rounded-md bg-accent-gold/15 text-[#8a690f] text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-accent-gold/40"
            aria-label={`Add back ${product.name}`}
          >
            <span aria-hidden>+</span>
            <span>Add back</span>
          </button>
        ) : (
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                bumpDown();
              }}
              disabled={qty <= 0}
              aria-label={`Decrease ${product.name}`}
              className="h-7 w-7 rounded-l-md border border-brand-blue text-brand-blue bg-white hover:bg-brand-blue-tint focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors duration-150 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center"
            >
              <span className="text-base leading-none">−</span>
            </button>
            <div className={qtyCellClass}>
              <QtyInput
                value={qty}
                onSet={handleQtyChange}
                ariaLabel={`${product.name} quantity`}
                className={qtyInputClass}
              />
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                bumpUp();
              }}
              aria-label={`Increase ${product.name}`}
              className="h-7 w-7 rounded-r-md bg-brand-blue text-white hover:bg-brand-blue-dark focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors duration-150 flex items-center justify-center"
            >
              <span className="text-base leading-none">+</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
