/**
 * Skeleton placeholders that mirror the painted chrome closely. Real
 * shapes (44px stepper pill, square image, producer eyebrow strip) keep
 * the swap from skeleton→content from jumping.
 *
 * Variants:
 *   - "grid"       : ProductCard grid variant (square image + 3 text rows + stepper pill).
 *   - "compact"    : ProductCard compact variant (scroll-strip card; same shape, tighter).
 *   - "row"        : ProductCard row variant (80px thumb + 3 text rows + 44px circle).
 *   - "draft"      : DraftLine row (qty pill + 2 text rows + small price).
 *   - "pack"       : Pack-row inside the detail sheet (name + sub + 36px qty button).
 *
 * No animate-pulse wrapper here — the parent decides whether to wrap
 * the whole loading region in one shimmer (cleaner) or stagger sections.
 */

export function ProductCardSkeleton({
  variant,
}: {
  variant: "grid" | "compact" | "row" | "draft" | "pack";
}) {
  if (variant === "grid" || variant === "compact") {
    const tight = variant === "compact";
    return (
      <div
        className={`shrink-0 rounded-xl border border-black/10 bg-white overflow-hidden ${
          tight ? "w-[40vw] max-w-[170px] min-w-[140px]" : ""
        }`}
      >
        <div className="aspect-square bg-black/8" />
        <div className={`${tight ? "p-3 space-y-1.5" : "p-3 space-y-2"}`}>
          <div className="h-3 w-14 rounded bg-black/8" />
          <div className="h-4 w-28 rounded bg-black/8" />
          <div className="h-3 w-20 rounded bg-black/8" />
          <div className="h-11 rounded-full bg-black/10 mt-1" />
        </div>
      </div>
    );
  }

  if (variant === "row") {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-black/[0.06]">
        <div className="h-20 w-20 shrink-0 rounded-md bg-black/8" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-3 w-16 rounded bg-black/8" />
          <div className="h-4 w-3/4 rounded bg-black/8" />
          <div className="h-3 w-1/2 rounded bg-black/8" />
        </div>
        <div className="h-11 w-11 rounded-full bg-black/10 shrink-0" />
      </div>
    );
  }

  if (variant === "draft") {
    return (
      <div className="flex items-center gap-3 py-2.5 px-1">
        <div className="h-10 w-12 rounded-md bg-black/8 shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-4 w-3/4 rounded bg-black/8" />
          <div className="h-3 w-1/2 rounded bg-black/8" />
        </div>
        <div className="h-3 w-12 rounded bg-black/8 shrink-0" />
      </div>
    );
  }

  // "pack"
  return (
    <div className="p-3 flex items-center justify-between gap-3">
      <div className="space-y-1.5 flex-1">
        <div className="h-4 w-32 rounded bg-black/8" />
        <div className="h-3 w-20 rounded bg-black/8" />
      </div>
      <div className="h-9 w-24 rounded-full bg-black/10 shrink-0" />
    </div>
  );
}

/** Pack-rows skeleton: the rows-only block inside ProductDetailContent
 *  shown until the server action returns priced packs. Wrapped in a
 *  card frame to match the painted rows. */
export function PackRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="mt-4 animate-pulse">
      <div className="card divide-y divide-black/8">
        {Array.from({ length: rows }).map((_, i) => (
          <ProductCardSkeleton key={i} variant="pack" />
        ))}
      </div>
    </div>
  );
}

/** DraftLine block skeleton: a card section of 4 draft-line rows
 *  separated by divider lines. Matches the real /guide painted layout. */
export function DraftLineBlockSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden divide-y divide-black/8">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-3">
          <ProductCardSkeleton variant="draft" />
        </div>
      ))}
    </div>
  );
}

/** DraftStrip skeleton: a 2-row × N-column grid of DraftTile placeholders.
 *  Image square + 2-line name bar + pill row, all sized to the painted
 *  tile so the swap doesn't jump. */
export function DraftStripSkeleton({
  rows = 2,
  columns = 4,
}: {
  rows?: 1 | 2 | 3;
  columns?: number;
}) {
  const total = rows * columns;
  return (
    <div className="overflow-hidden">
      <div
        className={`grid grid-flow-col auto-cols-[96px] gap-x-3 gap-y-3 ${
          rows === 1
            ? "grid-rows-[auto]"
            : rows === 2
              ? "grid-rows-[auto_auto]"
              : "grid-rows-[auto_auto_auto]"
        }`}
      >
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="flex flex-col">
            <div className="h-24 w-24 rounded-md bg-black/8" />
            <div className="pt-1.5 space-y-1">
              <div className="h-3 w-20 rounded bg-black/8" />
              <div className="h-3 w-14 rounded bg-black/8" />
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <div className="h-7 w-10 rounded-md bg-black/10" />
              <div className="h-3 w-10 rounded bg-black/8" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Horizontal scroll-strip skeleton: a row of compact card skeletons. */
export function ScrollStripSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} variant="compact" />
      ))}
    </div>
  );
}
