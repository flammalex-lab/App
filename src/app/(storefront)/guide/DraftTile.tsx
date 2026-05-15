"use client";

import Image from "next/image";
import { useCart, type CartLine } from "@/lib/cart/store";
import { QtyInput } from "@/components/ui/QtyInput";
import { displayProductName } from "@/lib/utils/product-display";
import { productPhoto } from "@/lib/utils/product-image";
import { useProductSheet } from "@/lib/products/detail-sheet-store";
import { ProductCardFallback } from "@/components/products/ProductCardFallback";
import {
  PriceLine,
  ProducerEyebrow,
  haptic,
} from "@/components/products/primitives";
import type { GuideRow } from "./page";

/**
 * Horizontal order-guide tile. 80px image on the left; on the right
 * the content stacks name + price on top, producer eyebrow + stepper
 * pinned to the bottom (producer sits directly above the stepper per
 * the design pass). Tiles are fixed height (set by the grid row) so
 * shorter-name tiles don't render shorter than longer-name siblings —
 * keeps the 3-row strip visually even.
 *
 * No rhythm state. The order guide is a flat list of products; the
 * stepper just controls cart qty (0/N). When qty=0 the [−] disables;
 * when qty>0 the qty cell tints blue to signal "this is in your order".
 *
 * Stepper is a segmented control: single outer brand-blue border with
 * internal dividers from the qty cell's border-l/r. Buttons are 44px
 * (iOS HIG); total stepper width 136px including the outer border.
 *
 * Tap targets:
 *   - −/+      → bump qty by one
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
  const setQty = useCart((s) => s.setQty);
  const add = useCart((s) => s.add);

  const qty = line?.quantity ?? 0;
  const inCart = qty > 0;

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
      setQty(product.id, 0, variantKey);
      return;
    }
    if (qty === 0) {
      add(cartLineFromProduct(next));
    } else {
      setQty(product.id, next, variantKey);
    }
  }

  function bumpUp() {
    haptic(8);
    handleQtyChange(qty + 1);
  }
  function bumpDown() {
    haptic(6);
    handleQtyChange(Math.max(0, qty - 1));
  }

  function openDetail() {
    useProductSheet.getState().open(product, { packs: row.packs });
  }

  const qtyCellBg = inCart ? "bg-brand-blue-tint" : "bg-white";
  const qtyInputClass = inCart
    ? "h-full w-full text-center tabular text-[14px] font-semibold bg-transparent border-none text-brand-blue-dark focus:outline-none"
    : "h-full w-full text-center tabular text-[14px] font-semibold bg-transparent border-none text-brand-blue focus:outline-none";

  return (
    <div className="group/tile relative w-[248px] h-full flex items-start gap-3 p-2 rounded-xl border border-black/10 bg-white snap-start transition-colors duration-150 [@media(hover:hover)]:hover:border-black/20 focus-within:ring-2 focus-within:ring-brand-blue/40 focus-within:border-brand-blue">
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

      <div className="flex-1 min-w-0 h-full flex flex-col relative">
        <div className="pointer-events-none">
          <div
            className="text-[13px] font-semibold leading-snug text-ink-primary line-clamp-2"
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

        <div className="mt-auto pt-1">
          {product.producer ? (
            <div className="pointer-events-none mb-1">
              <ProducerEyebrow producer={product.producer} />
            </div>
          ) : null}
          <div className="inline-flex h-11 rounded-md overflow-hidden border-2 border-brand-blue self-start">
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
        </div>
      </div>
    </div>
  );
}
