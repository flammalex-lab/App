"use client";

import { useEffect, useRef, useState } from "react";
import { DraftTile } from "./DraftTile";
import type { GuideRow } from "./page";

/**
 * Horizontal-scroll grid of DraftTile. Tiles flow column-by-column so a
 * "row count" of 2 means the strip is 2 tiles tall and overflow scrolls
 * right. With ~96px tile width + 12px gap, mobile fits ~3 columns of
 * visible tiles (6 items per viewport at rows=2) and the rest live to
 * the right.
 *
 * Single-row branch: when the input fits in ≤3 tiles, render a single
 * row instead of a half-empty 2-row grid.
 *
 * Edge fades hint at horizontal overflow on the right side; a symmetric
 * left fade appears once the rail has been scrolled. Suppressed when
 * the rail's content fits entirely.
 */
export function DraftStrip({
  rows: requestedRows = 2,
  tiles,
}: {
  rows?: 1 | 2 | 3;
  tiles: GuideRow[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflowLeft, setOverflowLeft] = useState(false);
  const [overflowRight, setOverflowRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function update() {
      if (!el) return;
      setOverflowLeft(el.scrollLeft > 4);
      setOverflowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    }
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [tiles.length]);

  if (tiles.length === 0) return null;

  // Single-row branch — a 2-row grid with 1-3 items reads as broken.
  const rows = tiles.length <= 3 ? 1 : Math.min(requestedRows, 3);

  const gridRowsClass =
    rows === 1
      ? "grid-rows-[auto]"
      : rows === 2
        ? "grid-rows-[auto_auto]"
        : "grid-rows-[auto_auto_auto]";

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="overflow-x-auto overscroll-x-contain snap-x snap-proximity -mx-1 px-1 pb-1"
      >
        <div
          className={`grid grid-flow-col ${gridRowsClass} auto-cols-[96px] gap-x-3 gap-y-3`}
        >
          {tiles.map((t) => (
            <DraftTile key={t.product.id} row={t} />
          ))}
        </div>
      </div>
      {overflowLeft ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent"
        />
      ) : null}
      {overflowRight ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent"
        />
      ) : null}
    </div>
  );
}
