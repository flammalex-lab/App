/**
 * Loading state for the intercept-modal product preview. The non-modal
 * /catalog/[id] route already had a loading.tsx (PR #37), but the parallel
 * @modal/(.)catalog interception path doesn't enter the same Suspense
 * boundary — so tapping a card showed ~1 second of zero feedback while
 * the modal compiled server-side. This skeleton mounts immediately on
 * URL commit so the buyer sees the sheet placeholder while the real modal
 * loads.
 *
 * Server component (no "use client") — we can render a static skeleton
 * that mimics the ProductModal shape without the BottomSheet's gesture
 * logic. The real ProductModal swaps in when data loads.
 *
 * NOTE: no entrance animation on the panel itself. Earlier the panel
 * used `animate-sheet-up md:animate-slide-up`, but the buyer saw a
 * visible "expand twice" effect because the real ProductModal would
 * swap-mount MID-animation: the skeleton was at translateY(30%) when
 * the data-loaded sheet replaced it at translateY(0). With the panel
 * already in its resting position, the swap-in is just `animate-pulse
 * → real content`, no expand. The backdrop's `animate-fade-in` still
 * provides perceived "modal opening" feedback.
 */
export default function ProductModalLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center bg-black/55 animate-fade-in pointer-events-none">
      <div
        className="relative w-full bg-white rounded-t-2xl md:rounded-2xl shadow-floating h-[75vh] md:h-auto md:max-h-[92vh] flex flex-col animate-pulse"
        style={{ maxWidth: "64rem" }}
      >
        {/* Drag handle */}
        <div className="md:hidden pt-2 pb-2 flex items-center justify-center">
          <span aria-hidden className="block h-1 w-10 rounded-full bg-black/15" />
        </div>
        {/* Title row */}
        <div className="px-5 pt-2 md:pt-5 pb-3 flex items-start justify-between gap-3 border-b border-black/[0.06]">
          <div className="space-y-2 flex-1">
            <div className="h-6 w-2/3 rounded bg-black/5" />
            <div className="h-3 w-32 rounded bg-black/5" />
          </div>
          <div className="h-9 w-9 rounded-full bg-black/5" />
        </div>
        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="aspect-square rounded-xl bg-black/[0.04]" />
          <div className="space-y-2">
            <div className="h-3 w-24 rounded bg-black/5" />
            <div className="h-5 w-3/4 rounded bg-black/5" />
            <div className="h-3 w-1/2 rounded bg-black/5" />
          </div>
          <div className="card divide-y divide-black/5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="p-3 flex items-center justify-between">
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-28 rounded bg-black/5" />
                  <div className="h-3 w-16 rounded bg-black/5" />
                </div>
                <div className="h-9 w-24 rounded-full bg-black/5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
