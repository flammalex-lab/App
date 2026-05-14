/**
 * Skeleton for /orders/[id]. Real receipt layout:
 *   - "← Orders" back link
 *   - eyebrow "DELIVERY · {date}" (uppercase tracking-wide)
 *   - display h1 with order number (big tabular numeral)
 *   - status badge + "Placed by {name} · {date}" line
 *   - items header row ("{n} units" · "Line total")
 *   - card with line items (image + name + qty/price + line total)
 *   - totals block (subtotal, optional delivery, dashed divider, total)
 *   - primary "Reorder" CTA + secondary "Save as standing" CTA
 * Pulse rides the body — back link + eyebrow + title stay still.
 */
export default function OrderDetailLoading() {
  return (
    <div className="max-w-3xl mx-auto pt-3 pb-24">
      <div className="mb-3 h-4 w-20 rounded bg-black/8" />
      <div className="h-3 w-32 rounded bg-black/8 mb-1" />
      <div className="h-9 md:h-10 w-52 rounded bg-black/8 mb-3" />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="h-5 w-16 rounded-full bg-black/8" />
        <div className="h-4 w-48 rounded bg-black/8" />
      </div>
      <div className="mt-6 mb-1.5 flex items-baseline justify-between">
        <div className="h-3 w-16 rounded bg-black/8" />
        <div className="h-3 w-20 rounded bg-black/8" />
      </div>
      <div className="card divide-y divide-black/8 overflow-hidden animate-pulse">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="p-3 flex items-start gap-3">
            <div className="h-10 w-10 rounded-md bg-black/8 shrink-0" />
            <div className="flex-1 space-y-2 min-w-0">
              <div className="h-4 w-3/4 rounded bg-black/8" />
              <div className="h-3 w-1/2 rounded bg-black/8" />
            </div>
            <div className="h-4 w-16 rounded bg-black/8 shrink-0" />
          </div>
        ))}
      </div>
      <div className="mt-5 px-2 space-y-1.5 animate-pulse">
        <div className="flex justify-between">
          <div className="h-4 w-20 rounded bg-black/8" />
          <div className="h-4 w-16 rounded bg-black/8" />
        </div>
        <div className="border-t border-dashed border-black/15 my-2" />
        <div className="flex justify-between">
          <div className="h-5 w-16 rounded bg-black/10" />
          <div className="h-5 w-20 rounded bg-black/10" />
        </div>
      </div>
      <div className="mt-5 h-12 rounded-md bg-black/10" />
      <div className="mt-3 h-12 rounded-md bg-black/8" />
    </div>
  );
}
