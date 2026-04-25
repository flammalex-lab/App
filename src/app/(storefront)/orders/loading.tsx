export default function OrdersLoading() {
  return (
    <div className="max-w-screen-xl mx-auto animate-pulse">
      <div className="h-8 w-32 rounded bg-black/5 md:mx-0 mb-4" />
      <div className="card divide-y divide-black/5 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-3">
            <div className="h-4 w-28 rounded bg-black/5 mb-2" />
            <div className="h-3 w-60 rounded bg-black/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
