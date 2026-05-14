/**
 * Skeleton for /catalog/[id] (PDP). Mirrors the real ProductDetailContent
 * layout:
 *   - "← Catalog" back link
 *   - bordered card wrapper that's md:rounded-2xl
 *   - md:grid-cols-2 split: image (aspect-[4/3] mobile / min-h tall on md)
 *     on the left, content column (producer chip + display title + pack rows
 *     + add-to-cart-style row) on the right
 * Aspect ratio matches real (aspect-[4/3], NOT aspect-square — the old
 * skeleton was shorter and caused a noticeable jump when the photo arrived).
 */
export default function PDPLoading() {
  return (
    <div className="max-w-5xl mx-auto pb-8">
      <div className="pt-4">
        <div className="h-4 w-24 rounded bg-black/8" />
      </div>
      <div className="md:rounded-2xl md:border md:border-black/[0.06] md:bg-white md:overflow-hidden mt-3">
        <div className="md:grid md:grid-cols-2 md:gap-0">
          <div className="relative aspect-[4/3] md:aspect-auto md:min-h-[480px] bg-black/8 border-b md:border-b-0 md:border-r border-black/[0.06]" />
          <div className="px-5 md:px-8 pb-6 pt-4 md:py-10 animate-pulse">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-black/8" />
              <div className="h-4 w-32 rounded bg-black/8" />
            </div>
            <div className="h-8 md:h-9 w-3/4 rounded bg-black/8 mt-3" />
            <div className="h-4 w-40 rounded bg-black/8 mt-3" />
            <div className="card divide-y divide-black/8 overflow-hidden mt-5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="p-3 flex items-center justify-between gap-3">
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="h-4 w-40 rounded bg-black/8" />
                    <div className="h-3 w-24 rounded bg-black/8" />
                  </div>
                  <div className="h-9 w-24 rounded-full bg-black/10 shrink-0" />
                </div>
              ))}
            </div>
            <div className="h-12 rounded-md bg-black/10 mt-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
