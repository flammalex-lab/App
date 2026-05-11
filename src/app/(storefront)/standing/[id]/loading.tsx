export default function StandingDetailLoading() {
  return (
    <div className="max-w-2xl mx-auto pt-3 pb-12 animate-pulse">
      <div className="h-3 w-28 rounded bg-black/5 mb-3" />
      <div className="h-7 w-2/3 rounded bg-black/5 mb-5" />
      <div className="card p-4 space-y-3 mb-4">
        <div className="h-4 w-24 rounded bg-black/5" />
        <div className="h-10 rounded bg-black/5" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-10 rounded bg-black/5" />
          <div className="h-10 rounded bg-black/5" />
        </div>
      </div>
      <div className="card p-4">
        <div className="h-5 w-16 rounded bg-black/5 mb-3" />
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded bg-black/5" />
          ))}
        </div>
      </div>
    </div>
  );
}
