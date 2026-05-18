import { ScrollStripSkeleton } from "@/components/products/primitives";

/**
 * Skeleton shown while /catalog loads. The page mounts inside
 * catalog/layout.tsx, which already renders the editorial hero + the
 * StickySearchBar — so this skeleton starts where the page does:
 * category chips, then (when group-filtered) producer chips, then
 * ~3 horizontal scroll strips of vertical cards.
 *
 * Strip and card shapes come from the shared primitives so the skeleton
 * matches the real ProductCard chrome (square image, eyebrow, title,
 * price, 44px stepper pill) — minimizing the visible jump when content
 * paints.
 *
 * B2 (cloud-session QA, 2026-05-18): bumped chip contrast, added the
 * second row of producer-chip placeholders, gave each section header a
 * count + "See all" stub on the right, and widened the section eyebrow
 * line so the swap from skeleton → painted strip doesn't shove content
 * down by ~24px.
 */
export default function CatalogLoading() {
  return (
    <div className="max-w-screen-xl mx-auto pb-8">
      {/* Category chips — first row. 7 placeholders matches the real
          allowed-groups count for most buyer types (All + 5-6 groups +
          Best sellers). bg-black/10 ≈ the painted chip's border weight
          so the skeleton reads as a chip strip, not faint blocks. */}
      <div className="flex gap-1.5 mb-2 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="h-8 w-20 rounded-full bg-black/10 shrink-0"
          />
        ))}
      </div>
      {/* Producer chips — second row. Reserves the ~28px vertical slot
          that ProducerChips occupies on every group-filtered view, so
          /catalog?group=dairy doesn't snap up by a chip-row when the
          skeleton drops. Slightly smaller chips (h-6 vs h-8) match the
          ProducerChips inline style. */}
      <div className="flex gap-2 mb-4 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-6 w-16 rounded-full bg-black/[0.07] shrink-0"
          />
        ))}
      </div>
      <div className="animate-pulse">
        {[0, 1, 2].map((i) => (
          <section key={i} className="mb-5">
            {/* Section header — title + count on the left, "See all" stub
                on the right. Title widened to w-44 to match the painted
                17px h2 length range. */}
            <div className="flex items-baseline justify-between mb-2">
              <div className="flex items-baseline gap-2">
                <div className="h-4 w-44 rounded bg-black/10" />
                <div className="h-3 w-12 rounded bg-black/[0.07]" />
              </div>
              <div className="h-3 w-14 rounded bg-black/[0.07]" />
            </div>
            <ScrollStripSkeleton count={4} />
          </section>
        ))}
      </div>
    </div>
  );
}
