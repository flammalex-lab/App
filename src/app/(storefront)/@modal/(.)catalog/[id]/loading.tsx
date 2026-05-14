/**
 * Loading state for the intercept-modal product preview.
 *
 * Design goals (buyer feedback: "jarring" first-paint):
 *   - Backdrop appears INSTANTLY (no fade). Even a 200ms fade reads as
 *     "the page is darkening for some reason" before the user has a
 *     mental model for what's happening; an instant overlay reads
 *     simply as "you tapped a thing, here it comes."
 *   - Panel uses real-modal anatomy (image hero + title + price + a
 *     short variant list) at higher contrast so it's clearly a
 *     distinct surface — not a ghost of the catalog behind it.
 *   - No entrance animation on the panel itself. The buyer reported a
 *     "double expand" effect because the real ProductModal would
 *     swap-mount mid-slide; sitting in resting position from frame 1
 *     avoids that.
 *   - `pointer-events-none` on the wrapper so a slow load doesn't trap
 *     the buyer — they can still tap through to the catalog if they
 *     change their mind.
 *
 * Server component (no `"use client"`) — static skeleton mirroring
 * ProductModal's shape. The real ProductModal swaps in when data
 * resolves.
 */
export default function ProductModalLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center bg-black/60 pointer-events-none">
      <div
        className="relative w-full bg-white rounded-t-2xl md:rounded-2xl shadow-floating h-[75vh] md:h-auto md:max-h-[92vh] flex flex-col animate-pulse"
        style={{ maxWidth: "64rem" }}
      >
        {/* Drag handle (mobile) */}
        <div className="md:hidden pt-2 pb-2 flex items-center justify-center">
          <span aria-hidden className="block h-1 w-10 rounded-full bg-black/15" />
        </div>
        {/* Title row */}
        <div className="px-5 pt-2 md:pt-5 pb-3 flex items-start justify-between gap-3 border-b border-black/[0.06]">
          <div className="space-y-2 flex-1">
            <div className="h-7 w-2/3 rounded bg-black/8" />
            <div className="h-3 w-32 rounded bg-black/8" />
          </div>
          <div className="h-9 w-9 rounded-full bg-black/8 shrink-0" />
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="aspect-square rounded-xl bg-black/8" />
          <div className="space-y-2">
            <div className="h-3 w-24 rounded bg-black/8" />
            <div className="h-6 w-1/2 rounded bg-black/8" />
            <div className="h-3 w-3/4 rounded bg-black/8" />
          </div>
          <div className="card divide-y divide-black/8">
            {[0, 1, 2].map((i) => (
              <div key={i} className="p-3 flex items-center justify-between">
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-28 rounded bg-black/8" />
                  <div className="h-3 w-16 rounded bg-black/8" />
                </div>
                <div className="h-9 w-24 rounded-full bg-black/10" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
