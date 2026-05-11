export default function PDPLoading() {
  return (
    <div className="max-w-screen-md mx-auto pt-3 pb-24 animate-pulse">
      <div className="h-3 w-20 rounded bg-black/5 mb-3" />
      <div className="aspect-square rounded-xl bg-black/[0.04] mb-4" />
      <div className="space-y-2 mb-5">
        <div className="h-3 w-24 rounded bg-black/5" />
        <div className="h-8 w-3/4 rounded bg-black/5" />
        <div className="h-4 w-32 rounded bg-black/5" />
      </div>
      <div className="card divide-y divide-black/5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="p-4 flex items-center justify-between">
            <div className="space-y-2 flex-1">
              <div className="h-4 w-32 rounded bg-black/5" />
              <div className="h-3 w-20 rounded bg-black/5" />
            </div>
            <div className="h-9 w-24 rounded-full bg-black/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
