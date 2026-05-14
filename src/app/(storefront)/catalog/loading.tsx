/**
 * Skeleton shown while /catalog loads. The page mounts inside
 * catalog/layout.tsx, which already renders the editorial hero + the
 * StickySearchBar — so this skeleton starts where the page does:
 * category chips, then ~3 horizontal scroll strips of vertical cards.
 * Card aspect-square matches the real ProductCard image footprint.
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
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 4 }).map((_, j) => (
                <div
                  key={j}
                  className="w-[40vw] max-w-[170px] min-w-[140px] shrink-0 rounded-xl border border-black/10 bg-white"
                >
                  <div className="aspect-square bg-black/8" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 w-12 rounded bg-black/8" />
                    <div className="h-4 w-28 rounded bg-black/8" />
                    <div className="h-3 w-20 rounded bg-black/8" />
                    <div className="h-9 rounded-full bg-black/10 mt-2" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
