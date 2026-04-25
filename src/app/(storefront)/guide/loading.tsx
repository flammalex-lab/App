export default function GuideLoading() {
  return (
    <div className="max-w-screen-xl mx-auto pb-8 animate-pulse">
      <div className="mb-3">
        <div className="h-10 rounded-md bg-black/5" />
      </div>
      {[0, 1, 2].map((i) => (
        <section key={i} className="mb-4 ">
          <div className="h-4 w-40 rounded bg-black/5 mb-2" />
          <div className="grid grid-flow-col auto-cols-[200px] gap-2" style={{ gridTemplateRows: "1fr 1fr" }}>
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="h-[72px] rounded-lg border border-black/10 bg-white" />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
