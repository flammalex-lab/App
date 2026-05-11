export default function StandingLoading() {
  return (
    <div className="max-w-2xl mx-auto pt-3 pb-12 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-7 w-44 rounded bg-black/5" />
        <div className="h-9 w-28 rounded bg-black/5" />
      </div>
      <div className="card divide-y divide-black/5 overflow-hidden">
        {[0, 1].map((i) => (
          <div key={i} className="p-4 space-y-2">
            <div className="h-5 w-1/2 rounded bg-black/5" />
            <div className="h-3 w-2/3 rounded bg-black/5" />
            <div className="flex gap-2 pt-1">
              <div className="h-5 w-12 rounded-full bg-black/5" />
              <div className="h-5 w-12 rounded-full bg-black/5" />
              <div className="h-5 w-12 rounded-full bg-black/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
