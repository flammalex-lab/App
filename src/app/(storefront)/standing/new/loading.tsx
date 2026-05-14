/**
 * Skeleton for /standing/new. Same form layout as /standing/[id], plus
 * the subtitle paragraph the real page renders below the h1.
 */
export default function NewStandingLoading() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="h-8 w-64 rounded bg-black/8 mb-1" />
      <div className="h-4 w-3/4 rounded bg-black/8 mb-4" />
      <div className="space-y-4 animate-pulse">
        <div className="card p-4 space-y-3">
          <div className="space-y-1.5">
            <div className="h-3 w-16 rounded bg-black/8" />
            <div className="h-10 rounded-md bg-black/8" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="h-3 w-16 rounded bg-black/8" />
              <div className="h-10 rounded-md bg-black/8" />
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-24 rounded bg-black/8" />
              <div className="flex flex-wrap gap-1 pt-1">
                {[0, 1, 2, 3, 4, 5, 6].map((j) => (
                  <div key={j} className="h-7 w-10 rounded-full bg-black/8" />
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 pt-1">
            <div className="h-4 w-56 rounded bg-black/8" />
            <div className="h-4 w-16 rounded bg-black/8" />
          </div>
        </div>
        <div className="card p-4">
          <div className="h-5 w-16 rounded bg-black/8 mb-3" />
          <div className="h-10 rounded-md bg-black/8" />
          <div className="mt-2 space-y-2">
            {[0, 1, 2].map((j) => (
              <div key={j} className="flex justify-between items-center">
                <div className="h-4 w-1/2 rounded bg-black/8" />
                <div className="h-5 w-14 rounded-full bg-black/8" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
