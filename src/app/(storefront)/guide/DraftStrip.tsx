"use client";

import { useRef } from "react";
import { DraftTile, type DraftItem } from "./DraftTile";

/**
 * Horizontal-scroll grid of DraftTiles. Tiles flow column-by-column so a
 * "row count" of 3 means the strip is 3 tiles tall and overflow scrolls
 * right.
 *
 * Row heights are fixed (120px) so a short-name tile doesn't render
 * shorter than a 2-line-name sibling — keeps the rows visually even.
 * Tile width fixed at 248px to fit the 80px image + name/price/producer
 * stack + 44px segmented stepper.
 *
 * Smart row scaling: a strip with very few items collapses to fewer
 * rows so the grid doesn't look broken. With requestedRows=3, the
 * actual rows used is min(requested, ceil(count / 4)).
 */
export function DraftStrip({
  rows: requestedRows = 3,
  tiles,
}: {
  rows?: 1 | 2 | 3;
  tiles: DraftItem[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (tiles.length === 0) return null;

  const rows = Math.min(
    requestedRows,
    Math.max(1, Math.ceil(tiles.length / 4)),
  );

  const gridRowsClass =
    rows === 1
      ? "grid-rows-[120px]"
      : rows === 2
        ? "grid-rows-[120px_120px]"
        : "grid-rows-[120px_120px_120px]";

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="overflow-x-auto overscroll-x-contain -mx-1 px-1 pb-1"
      >
        <div
          className={`grid grid-flow-col ${gridRowsClass} auto-cols-[248px] gap-x-3 gap-y-3`}
        >
          {tiles.map((t) => (
            <DraftTile key={t.product.id} {...t} />
          ))}
        </div>
      </div>
    </div>
  );
}
