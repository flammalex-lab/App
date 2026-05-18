"use client";

import { useCallback, useState } from "react";
import type { PackOption, Product } from "@/lib/supabase/types";
import type { PackRow } from "@/app/(storefront)/catalog/[id]/packs";
import { useCart } from "@/lib/cart/store";
import { useProductSheet } from "@/lib/products/detail-sheet-store";
import { useGuideMemberships } from "@/lib/products/guide-memberships-store";
import { productPhoto } from "@/lib/utils/product-image";
import { displayProductName } from "@/lib/utils/product-display";
import { track } from "@/lib/analytics/track";
import { VariantPickerSheet } from "@/components/products/VariantPickerSheet";
import {
  ProducerEyebrow,
  producerHref,
  ProductMedia,
  ProductThumb,
  ProductStepper,
  PriceLine,
  InGuideFlag,
  PeakFlag,
  PausedBadge,
  WeekOffBadge,
  GuideStarButton,
  haptic,
} from "@/components/products/primitives";

/**
 * `packs` is the product's own priced variant list (default pack +
 * pack_options). Pre-computed by `buildSelfPacks` during the catalog/
 * guide page render so the client-state detail sheet can render fully-
 * priced rows at t=0 without waiting on a server action. Optional —
 * legacy callers can omit it and the sheet falls back to the
 * server-action loading path.
 */
export type PricedProduct = Product & {
  unitPrice: number | null;
  packs?: PackRow[];
};

type Variant = "grid" | "compact" | "row";

/**
 * Single canonical product card. Three visual variants share all cart +
 * availability logic; they differ only in layout.
 *
 *   - grid:    flat tile in a column grid (catalog grid view)
 *   - compact: vertical card for horizontal scroll strips
 *              (image-on-top, info+stepper below)
 *   - row:     full-width list row (producer-grouped category view)
 *
 * Built from the shared `primitives/` set — ProductMedia for the image+
 * badge layer, ProducerEyebrow for the producer caption, PriceLine for
 * the price+size strip, and ProductStepper (brand-blue, 44px) for the
 * qty controls. Green is reserved for commit-step buttons (Place order)
 * per the design system; that includes the variant picker sheet.
 *
 * The in-cart state is conveyed by the stepper alone (it swaps from
 * "+ Add" to the −/N/+ pill once a product is in the cart). A separate
 * top-right `× N` badge was tried and dropped — two pieces of chrome
 * encoding the same fact read as noisy.
 */
export function ProductCard({
  product,
  variant,
  fromGroup,
  inGuide = false,
  isB2B,
}: {
  product: PricedProduct;
  variant: Variant;
  fromGroup?: string | null;
  /**
   * Whether this product is in the active buyer's order guide. Used to
   * render the "In guide" badge. Default false — the buyer's guide
   * isn't fetched on every page, so callers must opt in.
   */
  inGuide?: boolean;
  /**
   * Whether the active session is a B2B buyer. Threaded into the
   * client-state detail sheet so it can render the "Add to guide"
   * affordance at t=0 without waiting on the server action. Omit on
   * legacy callsites — the sheet falls back to the server-action value.
   */
  isB2B?: boolean;
}) {
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  // Sum across every variant of this product so the card reflects total
  // quantity, not just the default pack. For a buyer who picked 3 cases
  // and 2 singles via the variant sheet, the card should say "5".
  const cartQtyTotal = useCart((s) =>
    s.lines
      .filter((l) => l.productId === product.id)
      .reduce((sum, l) => sum + l.quantity, 0),
  );
  const cartQtyDefault = useCart(
    (s) =>
      s.lines.find((l) => l.productId === product.id && l.variantKey === null)?.quantity ?? 0,
  );
  const cartQty = cartQtyTotal;
  const paused = product.available_b2b === false;
  const available = product.available_this_week && product.unitPrice != null && !paused;
  const packOptions = (product.pack_options as PackOption[] | null) ?? [];
  const hasVariants = packOptions.length > 0;

  const [variantOpen, setVariantOpen] = useState(false);

  const prodHref = producerHref(product.producer);

  // Tap → open the client-state detail sheet (Pepper-style). The card
  // already carries the full Product row AND the pre-computed pack
  // list (`product.packs`), so the sheet mounts INSTANTLY with title,
  // image, description, AND priced variant rows. The server action
  // only fires for sibling-grouped candidates (Whole Milk — Gallon /
  // Half Gallon) — a most-products fast path with zero round-trips.
  //
  // `inGuide` is read from the shared memberships store at click time
  // (not from the closed-over prop) so an optimistic toggle on the
  // card's GuideStarButton propagates into the sheet that this same
  // click opens. Falls back to the prop for products the store has
  // never seen — preserves SSR-rendered correctness on first paint.
  const openSheet = useCallback(() => {
    const live = useGuideMemberships.getState().byProduct[product.id];
    const effectiveInGuide = live ?? inGuide;
    useProductSheet.getState().open(product, {
      fromGroup,
      inGuide: effectiveInGuide,
      isB2B,
      packs: product.packs,
    });
  }, [product, fromGroup, inGuide, isB2B]);

  function addOne() {
    if (!available) return;
    if (hasVariants) {
      track("variant_picker_opened", {
        product_id: product.id,
        sku: product.sku,
        trigger: "add",
      });
      setVariantOpen(true);
      return;
    }
    haptic(8);
    add({
      productId: product.id,
      variantKey: null,
      variantSku: null,
      sku: product.sku,
      name: product.name,
      packSize: product.pack_size,
      unit: product.unit,
      unitPrice: product.unitPrice!,
      priceByWeight: Boolean(product.price_by_weight),
      quantity: 1,
    });
  }
  function sub() {
    if (hasVariants) {
      track("variant_picker_opened", {
        product_id: product.id,
        sku: product.sku,
        trigger: "subtract",
      });
      setVariantOpen(true);
      return;
    }
    haptic(6);
    setQty(product.id, Math.max(0, cartQtyDefault - 1), null);
  }
  function applyDirectQty(n: number) {
    if (n === 0) {
      setQty(product.id, 0, null);
      return;
    }
    if (cartQtyDefault === 0) {
      add({
        productId: product.id,
        variantKey: null,
        variantSku: null,
        sku: product.sku,
        name: product.name,
        packSize: product.pack_size,
        unit: product.unit,
        unitPrice: product.unitPrice!,
        priceByWeight: Boolean(product.price_by_weight),
        quantity: n,
      });
    } else {
      setQty(product.id, n, null);
    }
  }

  const defaultVariantPrices: Record<string, number | null> = {};
  for (const opt of packOptions) {
    defaultVariantPrices[opt.key] = opt.wholesale_price ?? opt.retail_price ?? null;
  }

  const richSize = product.case_pack ?? product.pack_size;
  const sizeLabel = richSize ?? product.unit;
  const displayName = displayProductName(
    product.name,
    product.producer,
    product.pack_size,
    product.case_pack,
  );

  const photo = productPhoto(product);
  const weekOff = !product.available_this_week && !paused;

  // ───────── Compact (vertical scroll-strip card) ─────────
  if (variant === "compact") {
    return (
      <>
        <div
          className={`group/card relative w-full h-full flex flex-col rounded-xl border border-black/10 bg-white overflow-hidden transition-colors duration-150 [@media(hover:hover)]:hover:border-black/20 focus-within:ring-2 focus-within:ring-brand-blue/40 focus-within:border-brand-blue ${paused ? "opacity-70" : ""}`}
        >
          <button
            type="button"
            onClick={openSheet}
            aria-label={product.name}
            className="absolute inset-x-0 top-0 bottom-[64px] z-0"
          />

          {/* Star overlay — moved off the bottom action row so the qty
              stepper has the full row width on narrow viewports. */}
          {isB2B ? (
            <div className="absolute top-1.5 right-1.5 z-10 pointer-events-auto">
              <GuideStarButton productId={product.id} initialInGuide={inGuide} />
            </div>
          ) : null}

          <ProductMedia
            product={product}
            photo={photo}
            aspect="square"
            fallbackSize="md"
            sizes="(max-width: 768px) 45vw, 200px"
            inGuide={isB2B ? false : inGuide}
            paused={paused}
            weekOff={weekOff}
          />

          <div className="relative px-3 pt-2 pb-2 flex flex-col gap-0.5 pointer-events-none">
            <ProducerEyebrow producer={product.producer} href={prodHref} />
            <div
              className="text-[14px] font-semibold leading-snug text-ink-primary truncate"
              title={product.name}
            >
              {displayName}
            </div>
            <PriceLine
              price={product.unitPrice}
              size={sizeLabel}
              weight="medium"
              textSize="xs"
              className="truncate mt-0.5"
            />
          </div>

          <div className="relative pointer-events-auto px-2 pb-2 mt-auto">
            <ProductStepper
              available={Boolean(available)}
              cartQty={cartQty}
              onAdd={addOne}
              onSub={sub}
              onSet={hasVariants ? undefined : applyDirectQty}
              fullWidth
              ariaProductName={product.name}
            />
          </div>
        </div>
        <SheetPortal />
      </>
    );
  }

  // ───────── Grid variant ─────────
  if (variant === "grid") {
    return (
      <>
        <div
          className={`group/card relative rounded-xl border border-black/10 bg-white overflow-hidden flex flex-col transition-all duration-150 [@media(hover:hover)]:hover:-translate-y-px [@media(hover:hover)]:hover:border-black/20 [@media(hover:hover)]:hover:shadow-card focus-within:ring-2 focus-within:ring-brand-blue/40 focus-within:border-brand-blue ${paused ? "opacity-70" : ""}`}
        >
          <button
            type="button"
            onClick={openSheet}
            aria-label={product.name}
            className="absolute inset-x-0 top-0 bottom-[64px] z-0"
          />

          {/* Star overlay — moved off the bottom action row so the qty
              stepper has the full row width on narrow viewports. */}
          {isB2B ? (
            <div className="absolute top-1.5 right-1.5 z-10 pointer-events-auto">
              <GuideStarButton productId={product.id} initialInGuide={inGuide} />
            </div>
          ) : null}

          <ProductMedia
            product={product}
            photo={photo}
            aspect="square"
            fallbackSize="md"
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
            inGuide={isB2B ? false : inGuide}
            paused={paused}
            weekOff={weekOff}
            zoomOnHover
          />

          <div className="relative px-3 pt-2 pb-2 flex flex-col gap-0.5 pointer-events-none">
            <ProducerEyebrow producer={product.producer} href={prodHref} />
            <div
              className="display text-[15px] font-semibold leading-snug text-ink-primary truncate mt-0.5"
              title={product.name}
            >
              {displayName}
            </div>
            <PriceLine
              price={product.unitPrice}
              size={sizeLabel}
              weight="semibold"
              textSize="sm"
              className="truncate mt-0.5"
            />
          </div>

          <div className="relative pointer-events-auto px-3 pb-3 mt-auto">
            <ProductStepper
              available={Boolean(available)}
              cartQty={cartQty}
              onAdd={addOne}
              onSub={sub}
              onSet={hasVariants ? undefined : applyDirectQty}
              fullWidth
              ariaProductName={product.name}
            />
          </div>
        </div>
        <SheetPortal />
      </>
    );
  }

  // ───────── Row variant (full-width list row) ─────────
  return (
    <div
      className={`group/card relative flex items-center gap-3 px-4 py-3 bg-white border-b border-black/[0.06] transition-colors duration-150 active:bg-bg-secondary ${paused ? "opacity-70" : ""}`}
    >
      <button
        type="button"
        onClick={openSheet}
        aria-label={product.name}
        className="absolute inset-0 z-0"
      />

      <ProductThumb product={product} photo={photo} sizePx={80} />

      <div className="flex-1 min-w-0 pointer-events-none">
        <div className="flex items-center gap-1.5 min-w-0">
          <ProducerEyebrow producer={product.producer} href={prodHref} />
          {/* InGuideFlag is suppressed for B2B because the new
              GuideStarButton on the right of the row already shows the
              in-guide state (filled star). PeakFlag stays — it's a
              separate marketing signal. */}
          {!isB2B && inGuide ? (
            <InGuideFlag />
          ) : (product as { is_peak?: boolean }).is_peak ? (
            <PeakFlag />
          ) : null}
        </div>
        <div
          className="text-[15px] font-semibold leading-snug text-ink-primary line-clamp-1 mt-0.5"
          title={product.name}
        >
          {displayName}
        </div>
        <div className="text-[13px] mt-0.5 truncate">
          <PriceLine
            price={product.unitPrice}
            size={sizeLabel}
            weight="medium"
            textSize="sm"
          />
          {paused ? (
            <span className="ml-2">
              <PausedBadge inline />
            </span>
          ) : null}
          {weekOff ? (
            <span className="ml-2">
              <WeekOffBadge inline />
            </span>
          ) : null}
        </div>
      </div>

      <div className="relative shrink-0 pointer-events-auto flex items-center gap-2">
        {isB2B ? (
          <GuideStarButton productId={product.id} initialInGuide={inGuide} />
        ) : null}
        <ProductStepper
          available={Boolean(available)}
          cartQty={cartQty}
          onAdd={addOne}
          onSub={sub}
          onSet={hasVariants ? undefined : applyDirectQty}
          ariaProductName={product.name}
        />
      </div>
      <SheetPortal />
    </div>
  );

  function SheetPortal() {
    if (!hasVariants) return null;
    return (
      <VariantPickerSheet
        open={variantOpen}
        onClose={() => setVariantOpen(false)}
        product={product}
        defaultUnitPrice={product.unitPrice}
        defaultVariantPrices={defaultVariantPrices}
      />
    );
  }
}
