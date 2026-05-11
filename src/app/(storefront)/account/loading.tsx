export default function AccountLoading() {
  return (
    <div className="max-w-2xl mx-auto pb-12 animate-pulse">
      <div className="flex flex-col items-center pt-4 pb-6">
        <div className="h-24 w-24 rounded-full bg-black/5" />
        <div className="h-7 w-40 rounded bg-black/5 mt-3" />
        <div className="h-4 w-28 rounded bg-black/5 mt-2" />
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="card p-4 mb-3">
          <div className="h-3 w-20 rounded bg-black/5 mb-3" />
          <div className="space-y-2">
            <div className="h-5 rounded bg-black/5" />
            <div className="h-5 rounded bg-black/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
