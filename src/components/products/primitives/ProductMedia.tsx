"use client";

import Image from "next/image";
import type { Product } from "@/lib/supabase/types";
import { ProductCardFallback } from "@/components/products/ProductCardFallback";
import {
  InGuideBadge,
  PausedBadge,
  PeakBadge,
  WeekOffBadge,
} from "@/components/products/primitives/ProductBadges";

/**
 * Standardized product media tile. Image (or no-photo fallback) with the
 * usual badge stack: InGuide / Peak top-left, Paused / Week-off top-right.
 *
 * Used by every card variant. The detail panel hero has its own
 * larger-radius treatment and uses ProductCardFallback directly — this
 * primitive is for tile/row chrome.
 *
 * Aspect: "square" matches catalog and guide cards (consistent with the
 * shelf metaphor). "auto" lets the parent control via wrapper height —
 * used by the row variant which uses a fixed 80px square.
 */
export function ProductMedia({
  product,
  photo,
  aspect = "square",
  fallbackSize = "md",
  sizes,
  inGuide,
  paused,
  weekOff,
  zoomOnHover,
  className,
}: {
  product: Product & Record<string, unknown>;
  photo: string | null;
  aspect?: "square" | "auto";
  fallbackSize?: "sm" | "md" | "lg";
  sizes: string;
  inGuide?: boolean;
  paused?: boolean;
  weekOff?: boolean;
  zoomOnHover?: boolean;
  className?: string;
}) {
  const isPeak = Boolean((product as { is_peak?: boolean }).is_peak);
  return (
    <div
      className={`relative ${aspect === "square" ? "aspect-square" : ""} flex items-center justify-center bg-white pointer-events-none overflow-hidden ${className ?? ""}`}
    >
      {photo ? (
        <Image
          src={photo}
          alt=""
          fill
          sizes={sizes}
          className={`object-contain mix-blend-multiply transition-transform duration-150 ${
            zoomOnHover ? "[@media(hover:hover)]:group-hover/card:scale-[1.03]" : ""
          }`}
        />
      ) : (
        <ProductCardFallback product={product} size={fallbackSize} />
      )}

      {inGuide ? <InGuideBadge /> : isPeak ? <PeakBadge /> : null}
      {paused ? <PausedBadge /> : null}
      {!paused && weekOff ? <WeekOffBadge /> : null}
    </div>
  );
}

/**
 * Small, square media tile for dense list contexts (row variant, draft
 * lines, stock-up rows). No badge overlays — those would crowd a 56–80px
 * thumbnail; the caller renders inline flags beside the producer eyebrow
 * instead.
 */
export function ProductThumb({
  product,
  photo,
  sizePx = 80,
  className,
}: {
  product: Product & Record<string, unknown>;
  photo: string | null;
  /** Outer square size in CSS pixels. Tailwind classes are computed for the common sizes. */
  sizePx?: 40 | 48 | 56 | 64 | 80;
  className?: string;
}) {
  // Tailwind doesn't ship h-14 w-14 etc. for arbitrary px values via class
  // string composition reliably — use inline style for the box and rely on
  // utility classes for everything else.
  return (
    <div
      className={`relative shrink-0 rounded-md overflow-hidden bg-bg-secondary flex items-center justify-center pointer-events-none ${className ?? ""}`}
      style={{ height: sizePx, width: sizePx }}
    >
      {photo ? (
        <Image
          src={photo}
          alt=""
          fill
          sizes={`${sizePx}px`}
          className="object-contain mix-blend-multiply"
        />
      ) : (
        <ProductCardFallback product={product} size="sm" />
      )}
    </div>
  );
}
