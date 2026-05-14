/**
 * Loading state for the intercept-modal product preview.
 *
 * **Must structurally match `ProductDetailContent`** so the swap-in is
 * invisible. Buyer reported the modal "jumping around" on load — root
 * cause was layout mismatch:
 *   - real modal: 2-column grid on md+ (image left, info right);
 *     stacked on mobile with `aspect-[4/3]` image
 *   - prior skeleton: single column on every viewport with
 *     `aspect-square` image
 * which made the swap a full reflow rather than a content fade.
 *
 * **Body lock here, not just in the real sheet.** Playwright trace caught
 * that the skeleton mounted at t≈7ms but body-lock didn't fire until
 * the real BottomSheet swapped in at t≈800ms (mobile) / t≈475ms (web).
 * For that ~half-second the catalog underneath stayed scrollable, and
 * the subsequent lock + scroll-restore registered to the buyer as a
 * "thunk." `<BodyScrollLock />` (Client Component) locks body from the
 * moment the skeleton mounts; BottomSheet's own lock takes over on
 * swap-in (same scrollY captured, same offset pinned, no visible
 * change).
 *
 * Other design constraints:
 *   - Backdrop appears instantly (no fade). Even 200ms of darkening
 *     reads as random page-state degradation; an instant overlay reads
 *     as direct response to the tap.
 *   - Panel sits in resting position (no entrance animation) so the
 *     real ProductModal — also rendered with `suppressEnterAnimation`
 *     — doesn't expand mid-mount.
 *   - `pointer-events-none` on the wrapper so a slow load doesn't trap
 *     the buyer.
 *
 * Server component (no `"use client"`).
 */
import { BodyScrollLock } from "@/components/ui/BodyScrollLock";

export default function ProductModalLoading() {
  return (
    <>
      <BodyScrollLock />
      <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center bg-black/60 pointer-events-none">
        <div
          className="relative w-full bg-white rounded-t-2xl md:rounded-2xl shadow-floating h-[75vh] md:h-auto md:max-h-[92vh] flex flex-col"
          style={{ maxWidth: "64rem" }}
        >
          {/* Drag handle (mobile only — matches BottomSheet) */}
          <div className="md:hidden pt-2 pb-2 flex items-center justify-center">
            <span aria-hidden className="block h-1 w-10 rounded-full bg-black/15" />
          </div>

          {/* Scroll region — must match ProductDetailContent's outer container.
              `animate-pulse` lives on the inner scroll region rather than the
              whole panel: when the real content swaps in, the pulse stopping
              reads as "content arrived" rather than "the whole sheet snapped."
              The panel itself stays solid (no pulse, no animation flip) through
              the skeleton→real transition. */}
          <div className="flex-1 overflow-y-auto animate-pulse">
            <div className="md:grid md:grid-cols-2 md:gap-0">
              {/* LEFT: image hero. Aspect-[4/3] on mobile, min-h-[480px] on md+. */}
              <div className="relative aspect-[4/3] md:aspect-auto md:min-h-[480px] bg-black/[0.04] border-b md:border-b-0 md:border-r border-black/[0.06]" />

              {/* RIGHT: info column */}
              <div className="px-5 md:px-8 pb-6 pt-4 md:py-10 space-y-3">
                {/* Producer chip */}
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded bg-black/8 shrink-0" />
                  <div className="h-4 w-28 rounded bg-black/8" />
                </div>

                {/* Title (display text-2xl md:text-3xl in the real) */}
                <div className="h-8 md:h-9 w-4/5 rounded bg-black/10" />

                {/* Pack caption */}
                <div className="h-3 w-1/2 rounded bg-black/8" />

                {/* Variant / pack rows (the real ProductDetailClient renders
                    a card with rows for each pack). Three is the median. */}
                <div className="pt-3">
                  <div className="card divide-y divide-black/8">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="p-3 flex items-center justify-between gap-3">
                        <div className="space-y-1.5 flex-1">
                          <div className="h-4 w-32 rounded bg-black/8" />
                          <div className="h-3 w-20 rounded bg-black/8" />
                        </div>
                        <div className="h-9 w-24 rounded-full bg-black/10 shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
