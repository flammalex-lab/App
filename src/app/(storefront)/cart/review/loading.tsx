/**
 * Skeleton for /cart/review. Real layout is:
 *   - "← Back to cart" link (small text)
 *   - display h1 "Review your order" (2xl / md:3xl)
 *   - small account-name subtitle
 *   - "When" card with calendar icon block + label + date
 *   - optional Note card (omitted from skeleton — won't always be there)
 *   - items card (collapsible header + line items)
 *   - estimated total row (display lg label + tabular 2xl total)
 *   - large primary button
 * The page itself sits on pt-6 not pt-3 like other surfaces.
 */
export default function ReviewLoading() {
  return (
    <div className="max-w-2xl mx-auto pt-6 pb-8">
      <div className="h-4 w-28 rounded bg-black/8 mb-2" />
      <div className="h-8 w-60 rounded bg-black/8 mt-2 mb-1" />
      <div className="h-4 w-36 rounded bg-black/8 mb-5" />
      <div className="space-y-3 animate-pulse">
        <div className="card p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-black/8 shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3 w-16 rounded bg-black/8" />
              <div className="h-5 w-48 rounded bg-black/8" />
            </div>
          </div>
        </div>
        <div className="card overflow-hidden divide-y divide-black/8">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="h-5 w-36 rounded bg-black/8" />
            <div className="h-5 w-4 rounded bg-black/8" />
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="p-3 flex items-start gap-3">
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-black/8" />
                <div className="h-3 w-1/2 rounded bg-black/8" />
              </div>
              <div className="h-4 w-16 rounded bg-black/8" />
            </div>
          ))}
        </div>
        <div className="px-1 pt-2 pb-4">
          <div className="flex items-baseline justify-between">
            <div className="h-6 w-32 rounded bg-black/8" />
            <div className="h-7 w-28 rounded bg-black/10" />
          </div>
          <div className="h-3 w-3/4 rounded bg-black/8 mt-2" />
        </div>
        <div className="h-12 rounded-md bg-black/10" />
      </div>
    </div>
  );
}
