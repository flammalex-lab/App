export default function ChatLoading() {
  return (
    <div className="max-w-2xl mx-auto pt-3 pb-8 animate-pulse">
      <div className="h-7 w-24 rounded bg-black/5 mb-4" />
      <div className="card flex flex-col h-[65vh]">
        <div className="flex-1 p-4 space-y-3">
          {[
            { mine: false, w: "w-2/3" },
            { mine: true, w: "w-1/2" },
            { mine: false, w: "w-3/4" },
            { mine: true, w: "w-1/3" },
            { mine: false, w: "w-1/2" },
          ].map((m, i) => (
            <div key={i} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
              <div className={`h-9 ${m.w} rounded-lg bg-black/5`} />
            </div>
          ))}
        </div>
        <div className="border-t border-black/5 p-3 flex gap-2">
          <div className="flex-1 h-10 rounded bg-black/5" />
          <div className="h-10 w-16 rounded bg-black/5" />
        </div>
      </div>
    </div>
  );
}
