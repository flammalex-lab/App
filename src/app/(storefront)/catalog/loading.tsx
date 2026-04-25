/**
 * Skeleton shown while /catalog loads. Mirrors the real layout so the
 * flash doesn't reposition content when data arrives — single-row
 * horizontal scroll strips of vertical cards (was 2-row 200px columns
 * in the older skeleton, which no longer matches the live UI).
 */
export default function CatalogLoading() {
  return (
    <div className="max-w-screen-xl mx-auto pb-8 animate-pulse">
      {/* Search bar */}
      <div className="mb-3">
        <div className="h-10 rounded-md bg-black/5" />
      </div>
      {/* Category chip strip */}
      <div className="flex gap-1.5 mb-4 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-20 rounded-full bg-black/5 shrink-0" />
        ))}
      </div>
      {/* Three scroll strips */}
      {[0, 1, 2].map((i) => (
        <section key={i} className="mb-5">
          <div className="h-4 w-32 rounded bg-black/5 mb-3" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 4 }).map((_, j) => (
              <div
                key={j}
                className="w-[40vw] max-w-[170px] min-w-[140px] shrink-0 rounded-xl border border-black/10 bg-white"
              >
                <div className="aspect-square bg-black/[0.03]" />
                <div className="p-3 space-y-2">
                  <div className="h-3 w-12 rounded bg-black/5" />
                  <div className="h-4 w-28 rounded bg-black/5" />
                  <div className="h-3 w-20 rounded bg-black/5" />
                  <div className="h-9 rounded-full bg-black/5 mt-2" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
