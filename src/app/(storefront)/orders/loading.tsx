/**
 * Skeleton for /orders. Real page layout:
 *   - display h1 "Orders"
 *   - tab strip (Upcoming · N / Past · N) with a brand-blue underline
 *   - card with one row per order: left-aligned order# + status badge +
 *     small meta line; right-aligned mono total.
 */
export default function OrdersLoading() {
  return (
    <div className="max-w-screen-xl mx-auto">
      <div className="h-8 w-32 rounded bg-black/8 mb-3" />
      <div className="flex border-b border-black/10 mb-3">
        <div className="flex-1 py-2.5 border-b-2 border-brand-blue/40 -mb-px">
          <div className="h-4 w-24 rounded bg-black/8 mx-auto" />
        </div>
        <div className="flex-1 py-2.5 -mb-px">
          <div className="h-4 w-20 rounded bg-black/8 mx-auto" />
        </div>
      </div>
      <div className="card divide-y divide-black/8 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center p-4 gap-3">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-baseline gap-2">
                <div className="h-4 w-28 rounded bg-black/8" />
                <div className="h-4 w-16 rounded-full bg-black/8" />
              </div>
              <div className="h-3 w-60 max-w-[60vw] rounded bg-black/8" />
            </div>
            <div className="h-4 w-16 rounded bg-black/8 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
