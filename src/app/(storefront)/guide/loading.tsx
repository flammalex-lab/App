/**
 * Skeleton for /guide. Real layout is the rhythm-driven draft surface:
 *   - one-line greeting eyebrow
 *   - display "Your draft for {day}, {date}" heading + sub-line + helper
 *   - sticky in-page search bar
 *   - 2–3 sub-category sections, each a full-width row card with stacked
 *     DraftLine rows (NOT horizontal scroll strips — the old skeleton
 *     rendered strips, which jumps massively when the list view paints).
 *   - a "Recent buys" strip below
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
      <div className="space-y-4 animate-pulse">
        {[0, 1, 2].map((i) => (
          <section key={i}>
            <div className="h-3 w-32 rounded bg-black/8 mb-1 ml-1" />
            <div className="card overflow-hidden divide-y divide-black/8">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="p-3 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-md bg-black/8 shrink-0" />
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="h-4 w-3/4 rounded bg-black/8" />
                    <div className="h-3 w-1/2 rounded bg-black/8" />
                  </div>
                  <div className="h-9 w-24 rounded-full bg-black/10 shrink-0" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="mt-6 animate-pulse">
        <div className="h-4 w-28 rounded bg-black/8 mb-3" />
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
                <div className="h-9 rounded-full bg-black/10 mt-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
