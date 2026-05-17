"use client";

import Image from "next/image";
import { useCart, type CartLine } from "@/lib/cart/store";
import { displayProductName } from "@/lib/utils/product-display";
import { productPhoto } from "@/lib/utils/product-image";
import { useProductSheet } from "@/lib/products/detail-sheet-store";
import { ProductCardFallback } from "@/components/products/ProductCardFallback";
import { ProductStepper } from "@/components/products/primitives/ProductStepper";
import {
  PriceLine,
  ProducerEyebrow,
  producerHref,
  haptic,
} from "@/components/products/primitives";
import type { Product } from "@/lib/supabase/types";
import type { PackRow } from "@/app/(storefront)/catalog/[id]/packs";

/**
 * Minimum input shape for a tile — both GuideRow (weekly orders) and a
 * trivially-wrapped PricedProductLite (recent buys / suggested / new
 * from your farms) satisfy this. Keeps DraftTile as the one tile for
 * every section on /guide.
 */
export type DraftItem = {
  product: Product;
  unitPrice: number | null;
  packs?: PackRow[];
};

/**
 * Horizontal order-guide tile used across every section on /guide.
 * 80px image on the left; on the right the content stacks tight —
 * name (line-clamp-1) → price+size → producer (linked) → stepper.
 * No flex-grow / mt-auto: stacking is top-down with the natural
 * height, and the grid row pins all tiles in a row to the same total
 * height for visual evenness.
 *
 * Click zones:
 *   - tile body (image, name, price area)  → opens product detail sheet
 *   - producer eyebrow                      → /catalog?producer=…
 *   - −/+ buttons + qty cell                → cart qty
 *
 * Implementation detail: the content wrapper is `pointer-events-none`
 * so its background falls through to the detail-open button under the
 * tile. The stepper wrapper re-enables pointer events on itself, and
 * ProducerEyebrow's Link is already `pointer-events-auto` so the
 * producer link captures its own clicks.
 */
export function DraftTile({
  product,
  unitPrice,
  packs,
}: DraftItem) {
  const variantKey = null;
  const price = unitPrice ?? 0;

  const line = useCart((s) =>
    s.lines.find((l) => l.productId === product.id && (l.variantKey ?? null) === variantKey),
  );
  const setQty = useCart((s) => s.setQty);
  const add = useCart((s) => s.add);

  const qty = line?.quantity ?? 0;

  const photo = productPhoto(product);
  const displayName = displayProductName(
    product.name,
    product.producer,
    product.pack_size,
    product.case_pack,
  );
  const richSize = product.case_pack ?? product.pack_size;
  const sizeLabel = richSize ?? product.unit;
  const prodHref = producerHref(product.producer);

  function cartLineFromProduct(quantity: number): CartLine {
    return {
      productId: product.id,
      variantKey: null,
      variantSku: null,
      sku: product.sku,
      name: product.name,
      packSize: product.pack_size,
      unit: product.unit,
      unitPrice: price,
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
    useProductSheet.getState().open(product, { packs });
  }

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

      <div className="relative flex-1 min-w-0 flex flex-col pointer-events-none">
        <div
          className="text-[13px] font-semibold leading-snug text-ink-primary truncate"
          title={product.name}
        >
          {displayName}
        </div>
        <PriceLine
          price={price > 0 ? price : null}
          size={sizeLabel}
          textSize="xs"
          weight="medium"
          className="truncate mt-0.5"
        />
        {product.producer ? (
          <ProducerEyebrow
            producer={product.producer}
            href={prodHref}
            className="mt-1"
          />
        ) : null}
        <div className="mt-1 pointer-events-auto w-full">
          <ProductStepper
            available
            cartQty={qty}
            onAdd={bumpUp}
            onSub={bumpDown}
            onSet={handleQtyChange}
            fullWidth
            ariaProductName={product.name}
          />
        </div>
      </div>
    </div>
  );
}
