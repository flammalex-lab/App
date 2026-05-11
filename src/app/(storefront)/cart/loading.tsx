export default function CartLoading() {
  return (
    <div className="max-w-2xl mx-auto pt-3 pb-24 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-5 w-24 rounded bg-black/5" />
        <div className="h-5 w-28 rounded bg-black/5" />
        <div className="w-[88px]" />
      </div>
      <div className="h-3 w-40 rounded bg-black/5 mx-auto mb-4" />
      <div className="card divide-y divide-black/5 overflow-hidden mb-3">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-black/5" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-16 rounded bg-black/5" />
            <div className="h-4 w-40 rounded bg-black/5" />
          </div>
        </div>
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-black/5" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-16 rounded bg-black/5" />
            <div className="h-4 w-32 rounded bg-black/5" />
          </div>
        </div>
      </div>
      <div className="card divide-y divide-black/5 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className="p-3 flex items-start gap-3">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-black/5" />
              <div className="h-3 w-1/2 rounded bg-black/5" />
            </div>
            <div className="h-9 w-28 rounded-full bg-black/5 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
