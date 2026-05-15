import {
  DraftStripSkeleton,
  ScrollStripSkeleton,
} from "@/components/products/primitives";

/**
 * Skeleton for /guide. Real layout is the rhythm-driven draft surface:
 *   - one-line greeting eyebrow
 *   - display "Your draft for {day}, {date}" heading + sub-line + helper
 *   - sticky in-page search bar
 *   - 2–3 sub-category sections, each a card with stacked DraftLine rows
 *   - a "Recent buys" scroll strip below
 *
 * Row shapes come from the shared primitives so a swap from skeleton→
 * painted draft lines doesn't cause a visual jump.
 */
export default function GuideLoading() {
  return (
    <div className="max-w-screen-xl mx-auto pb-8">
      <div className="pt-1 pb-2 h-4 w-44 rounded bg-black/8" />
      <div className="mb-3 pt-1 space-y-2">
        <div className="h-7 w-3/4 rounded bg-black/8" />
        <div className="h-3 w-1/2 rounded bg-black/8" />
        <div className="h-4 w-2/3 rounded bg-black/8 mt-2" />
      </div>
      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 py-2 bg-white/95 mb-3">
        <div className="h-10 rounded-md bg-black/8" />
      </div>
      <div className="animate-pulse">
        <DraftStripSkeleton rows={3} columns={5} />
      </div>
      <div className="mt-6 animate-pulse">
        <div className="h-4 w-28 rounded bg-black/8 mb-3" />
        <ScrollStripSkeleton count={4} />
      </div>
    </div>
  );
}
