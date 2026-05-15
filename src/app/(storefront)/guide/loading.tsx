import {
  DraftStripSkeleton,
  ScrollStripSkeleton,
} from "@/components/products/primitives";

/**
 * Skeleton for /guide. Real layout:
 *   - one-line greeting eyebrow
 *   - display "Your order guide for {day}, {date}" heading
 *   - in-eye-line submit pill
 *   - sticky in-page search bar
 *   - "Your weekly orders" DraftStrip (3-row horizontal scroll)
 *   - "Recent buys" / "Suggested" / "New from your farms" scroll strips
 */
export default function GuideLoading() {
  return (
    <div className="max-w-screen-xl mx-auto pb-8">
      <div className="pt-1 pb-2 h-4 w-44 rounded bg-black/8" />
      <div className="mb-3 pt-1">
        <div className="h-7 w-3/4 rounded bg-black/8" />
      </div>
      <div className="mb-4 h-11 rounded-xl bg-black/8" />
      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 py-2 bg-white/95 mb-3">
        <div className="h-10 rounded-md bg-black/8" />
      </div>
      <div className="animate-pulse">
        <div className="h-3 w-32 rounded bg-black/8 mb-2 ml-1" />
        <DraftStripSkeleton rows={3} columns={2} />
      </div>
      <div className="mt-6 animate-pulse">
        <div className="h-4 w-28 rounded bg-black/8 mb-3" />
        <ScrollStripSkeleton count={4} />
      </div>
      <div className="mt-4 animate-pulse">
        <div className="h-4 w-24 rounded bg-black/8 mb-3" />
        <ScrollStripSkeleton count={4} />
      </div>
      <div className="mt-4 animate-pulse">
        <div className="h-4 w-36 rounded bg-black/8 mb-3" />
        <ScrollStripSkeleton count={4} />
      </div>
    </div>
  );
}
