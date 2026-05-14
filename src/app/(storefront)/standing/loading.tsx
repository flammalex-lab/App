/**
 * Skeleton for /standing. Real layout:
 *   - h1 + "New" primary button row
 *   - vertical stack of cards, each: name + meta (freq · days · next run)
 *     on the left, status badge on the right, items list below, then a
 *     row of action buttons (Pause / Run now).
 * Matches the real max-w-screen-xl outer wrapper (the previous skeleton
 * used max-w-2xl, which clipped the layout on desktop).
 */
export default function StandingLoading() {
  return (
    <div className="max-w-screen-xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <div className="h-8 w-52 rounded bg-black/8" />
        <div className="h-9 w-16 rounded-md bg-black/10" />
      </div>
      <div className="space-y-3 animate-pulse">
        {[0, 1].map((i) => (
          <div key={i} className="card p-4">
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-5 w-1/2 rounded bg-black/8" />
                <div className="h-3 w-2/3 rounded bg-black/8" />
              </div>
              <div className="h-5 w-16 rounded-full bg-black/8 shrink-0" />
            </div>
            <div className="mt-3 space-y-1.5">
              {[0, 1, 2].map((j) => (
                <div key={j} className="flex justify-between">
                  <div className="h-4 w-40 rounded bg-black/8" />
                  <div className="h-4 w-16 rounded bg-black/8" />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <div className="h-8 w-16 rounded-md bg-black/8" />
              <div className="h-8 w-20 rounded-md bg-black/8" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
