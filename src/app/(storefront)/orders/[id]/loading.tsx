export default function OrderDetailLoading() {
  return (
    <div className="max-w-3xl mx-auto pt-3 pb-24 animate-pulse">
      <div className="h-3 w-20 rounded bg-black/5 mb-4" />
      <div className="h-3 w-32 rounded bg-black/5 mb-1" />
      <div className="h-8 w-52 rounded bg-black/5 mb-3" />
      <div className="flex gap-2 mb-6">
        <div className="h-5 w-16 rounded-full bg-black/5" />
        <div className="h-5 w-40 rounded bg-black/5" />
      </div>
      <div className="h-3 w-24 rounded bg-black/5 mb-2" />
      <div className="card divide-y divide-black/5 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="p-3 flex items-start gap-3">
            <div className="h-9 w-9 rounded-md bg-black/5 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-black/5" />
              <div className="h-3 w-1/2 rounded bg-black/5" />
            </div>
            <div className="h-4 w-16 rounded bg-black/5" />
          </div>
        ))}
      </div>
      <div className="mt-5 space-y-2 px-2">
        <div className="h-4 rounded bg-black/5" />
        <div className="h-4 rounded bg-black/5" />
        <div className="h-5 rounded bg-black/5" />
      </div>
    </div>
  );
}
