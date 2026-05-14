/**
 * Skeleton for /cart. Mirrors the real Pepper-style cart shell:
 *   - 3-col header (back / centered title / spacer)
 *   - tiny account-name eyebrow
 *   - delivery + note card (two rows, divided)
 *   - items header (count · subtotal · "Remove all")
 *   - items card (3 line-item rows)
 *   - totals block under the card
 * Pulse rides the inner stack, not the outer wrapper, so the header
 * sits still while the rows refresh in.
 */
export default function CartLoading() {
  return (
    <div className="overflow-x-clip">
      <div className="max-w-2xl mx-auto pt-3 pb-24">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center pt-3 pb-1 gap-2">
          <div className="justify-self-start h-5 w-28 rounded bg-black/8" />
          <div className="h-4 w-28 rounded bg-black/8" />
          <div aria-hidden />
        </div>
        <div className="h-3 w-32 rounded bg-black/8 mx-auto mb-3" />
        <div className="space-y-3 animate-pulse">
          <div className="card divide-y divide-black/8 overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-black/8" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-16 rounded bg-black/8" />
                <div className="h-4 w-40 rounded bg-black/8" />
              </div>
            </div>
            <div className="px-4 py-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-black/8" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-16 rounded bg-black/8" />
                <div className="h-4 w-32 rounded bg-black/8" />
              </div>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5 px-1">
              <div className="h-3 w-40 rounded bg-black/8" />
              <div className="h-3 w-16 rounded bg-black/8" />
            </div>
            <div className="card divide-y divide-black/8 overflow-hidden">
              {[0, 1, 2].map((i) => (
                <div key={i} className="p-3 flex items-start gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-black/8" />
                    <div className="h-3 w-1/2 rounded bg-black/8" />
                  </div>
                  <div className="h-9 w-28 rounded-full bg-black/8 shrink-0" />
                </div>
              ))}
            </div>
          </div>
          <div className="px-2 space-y-1 pt-1">
            <div className="flex justify-between">
              <div className="h-4 w-20 rounded bg-black/8" />
              <div className="h-4 w-16 rounded bg-black/8" />
            </div>
            <div className="border-t border-dashed border-black/15 my-2" />
            <div className="flex justify-between">
              <div className="h-5 w-32 rounded bg-black/10" />
              <div className="h-5 w-20 rounded bg-black/10" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
