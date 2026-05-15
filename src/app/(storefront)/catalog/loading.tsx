import { ScrollStripSkeleton } from "@/components/products/primitives";

/**
 * Skeleton shown while /catalog loads. The page mounts inside
 * catalog/layout.tsx, which already renders the editorial hero + the
 * StickySearchBar — so this skeleton starts where the page does:
 * category chips, then ~3 horizontal scroll strips of vertical cards.
 *
 * Strip and card shapes come from the shared primitives so the skeleton
 * matches the real ProductCard chrome (square image, eyebrow, title,
 * price, 44px stepper pill) — minimizing the visible jump when content
 * paints.
 */
export default function CatalogLoading() {
  return (
    <div className="max-w-screen-xl mx-auto pb-8">
      <div className="flex gap-1.5 mb-4 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-20 rounded-full bg-black/8 shrink-0" />
        ))}
      </div>
      <div className="animate-pulse">
        {[0, 1, 2].map((i) => (
          <section key={i} className="mb-5">
            <div className="h-4 w-32 rounded bg-black/8 mb-3" />
            <ScrollStripSkeleton count={4} />
          </section>
        ))}
      </div>
    </div>
  );
}
