export default function ReviewLoading() {
  return (
    <div className="max-w-2xl mx-auto pt-3 pb-24 animate-pulse">
      <div className="h-3 w-24 rounded bg-black/5 mb-2" />
      <div className="h-8 w-56 rounded bg-black/5 mb-1" />
      <div className="h-4 w-32 rounded bg-black/5 mb-5" />
      <div className="card p-4 mb-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-black/5" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-16 rounded bg-black/5" />
            <div className="h-5 w-48 rounded bg-black/5" />
          </div>
        </div>
      </div>
      <div className="card overflow-hidden mb-3 divide-y divide-black/5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="p-3 flex items-start gap-3">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-black/5" />
              <div className="h-3 w-1/2 rounded bg-black/5" />
            </div>
            <div className="h-4 w-16 rounded bg-black/5" />
          </div>
        ))}
      </div>
      <div className="px-1 mb-6 flex items-baseline justify-between">
        <div className="h-6 w-32 rounded bg-black/5" />
        <div className="h-7 w-28 rounded bg-black/5" />
      </div>
      <div className="h-12 rounded-md bg-black/5" />
    </div>
  );
}
