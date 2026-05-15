"use client";

import Image from "next/image";
import { useCart, type CartLine } from "@/lib/cart/store";
import { QtyInput } from "@/components/ui/QtyInput";
import { displayProductName } from "@/lib/utils/product-display";
import { productPhoto } from "@/lib/utils/product-image";
import { useProductSheet } from "@/lib/products/detail-sheet-store";
import { ProductCardFallback } from "@/components/products/ProductCardFallback";
import { PriceLine, haptic } from "@/components/products/primitives";
import type { GuideRow } from "./page";

/**
 * Horizontal draft tile: 80px image on the left, name + price + −/N/+
 * stepper stacked on the right. Border + radius match the catalog card
 * family so the draft and catalog read as the same visual system.
 *
 * Three visual states, mirroring DraftLine's:
 *   - SUGGESTED  : rhythm pre-filled qty. Qty cell tinted-blue.
 *   - ADJUSTED   : buyer changed qty. Qty cell white, blue ink.
 *   - SKIPPED    : tile dimmed + strikethrough name; the stepper is
 *                  replaced with a single full-width "+ Add back" button.
 *
 * STOCKOUT is NOT rendered here — substitute chips don't fit. The
 * parent (GuideClient) splits stockouts into a fullwidth DraftLine list
 * below the strip.
 *
 * Stepper buttons are exactly 44px square (iOS HIG minimum). The three
 * cells are flush against each other with a single outer brand-blue
 * border + internal dividers from the qty cell's border-l/r — reads as
 * a single segmented control rather than three loose buttons. Total
 * stepper width: 132px content + 4px outer border = 136px.
 *
 * Tap targets:
 *   - −/+      → bump qty (or restore from skipped via the "Add back" pill)
 *   - qty cell → focus QtyInput for direct numeric entry
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
  const richSize = product.case_pack ?? product.pack_size;
  const sizeLabel = richSize ?? product.unit;

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

  const qtyCellBg = isSuggested ? "bg-brand-blue-tint" : "bg-white";
  const qtyInputClass = isSuggested
    ? "h-full w-full text-center tabular text-[14px] font-semibold bg-transparent border-none text-brand-blue-dark focus:outline-none"
    : "h-full w-full text-center tabular text-[14px] font-semibold bg-transparent border-none text-brand-blue focus:outline-none";

  return (
    <div
      className={`group/tile relative w-[248px] flex items-stretch gap-3 p-2 rounded-xl border border-black/10 bg-white snap-start transition-colors duration-150 [@media(hover:hover)]:hover:border-black/20 focus-within:ring-2 focus-within:ring-brand-blue/40 focus-within:border-brand-blue ${
        skipped ? "opacity-50" : ""
      }`}
    >
      <button
        type="button"
        onClick={openDetail}
        aria-label={product.name}
        className="absolute inset-0 z-0 rounded-xl focus:outline-none"
      />

      <div className="relative shrink-0 h-20 w-20 rounded-md overflow-hidden bg-white flex items-center justify-center pointer-events-none">
        {photo ? (
          <Image
            src={photo}
            alt=""
            fill
            sizes="80px"
            className="object-contain mix-blend-multiply"
          />
        ) : (
          <ProductCardFallback product={product} size="sm" />
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-between relative">
        <div className="pointer-events-none">
          <div
            className={`text-[13px] font-semibold leading-snug text-ink-primary line-clamp-2 ${
              skipped ? "line-through text-ink-tertiary" : ""
            }`}
            title={product.name}
          >
            {displayName}
          </div>
          <PriceLine
            price={unitPrice > 0 ? unitPrice : null}
            size={sizeLabel}
            textSize="xs"
            weight="medium"
            className="truncate mt-0.5"
          />
        </div>

        {skipped ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleAddBack();
            }}
            className="mt-1 h-11 w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-accent-gold/15 text-[#8a690f] text-[13px] font-semibold hover:bg-accent-gold/25 focus:outline-none focus:ring-2 focus:ring-accent-gold/40 transition-colors duration-150"
            aria-label={`Add back ${product.name}`}
          >
            <span aria-hidden>+</span>
            <span>Add back</span>
          </button>
        ) : (
          <div className="mt-1 inline-flex h-11 rounded-md overflow-hidden border-2 border-brand-blue self-start">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                bumpDown();
              }}
              disabled={qty <= 0}
              aria-label={`Decrease ${product.name}`}
              className="h-full w-11 flex items-center justify-center bg-white text-brand-blue hover:bg-brand-blue-tint focus:outline-none transition-colors duration-150 disabled:opacity-30 disabled:pointer-events-none"
            >
              <span className="text-lg leading-none">−</span>
            </button>
            <div
              className={`h-full w-11 flex items-center justify-center border-l-2 border-r-2 border-brand-blue ${qtyCellBg}`}
            >
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
              className="h-full w-11 flex items-center justify-center bg-brand-blue text-white hover:bg-brand-blue-dark focus:outline-none transition-colors duration-150"
            >
              <span className="text-lg leading-none">+</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
