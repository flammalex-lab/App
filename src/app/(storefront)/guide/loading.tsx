export default function GuideLoading() {
  return (
    <div className="max-w-screen-xl mx-auto pb-8 animate-pulse">
      <div className="mb-3">
        <div className="h-10 rounded-md bg-black/5" />
      </div>
      {[0, 1, 2].map((i) => (
        <section key={i} className="mb-5">
          <div className="h-4 w-40 rounded bg-black/5 mb-3" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 4 }).map((_, j) => (
              <div
                key={j}
                className="w-[40vw] max-w-[170px] min-w-[140px] shrink-0 rounded-xl border border-black/10 bg-white"
              >
                <div className="aspect-square bg-black/[0.03]" />
                <div className="p-3 space-y-2">
                  <div className="h-3 w-12 rounded bg-black/5" />
                  <div className="h-4 w-28 rounded bg-black/5" />
                  <div className="h-3 w-20 rounded bg-black/5" />
                  <div className="h-9 rounded-full bg-black/5 mt-2" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
