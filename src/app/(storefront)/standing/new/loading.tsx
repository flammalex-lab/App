export default function NewStandingLoading() {
  return (
    <div className="max-w-2xl mx-auto pt-3 pb-12 animate-pulse">
      <div className="h-7 w-56 rounded bg-black/5 mb-4" />
      <div className="card p-4 space-y-3 mb-4">
        <div className="h-4 w-24 rounded bg-black/5" />
        <div className="h-10 rounded bg-black/5" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-10 rounded bg-black/5" />
          <div className="h-10 rounded bg-black/5" />
        </div>
        <div className="flex flex-wrap gap-1 pt-1">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-7 w-10 rounded-full bg-black/5" />
          ))}
        </div>
      </div>
      <div className="card p-4">
        <div className="h-5 w-16 rounded bg-black/5 mb-3" />
        <div className="h-10 rounded bg-black/5 mb-3" />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 rounded bg-black/5" />
          ))}
        </div>
      </div>
    </div>
  );
}
