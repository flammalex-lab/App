export default function ChatLoading() {
  return (
    <div className="-mx-4 md:-mx-6 lg:-mx-8 -mt-1 -mb-32 flex flex-col bg-white h-[calc(100dvh-52px)] md:h-[calc(100dvh-86px)] animate-pulse">
      {/* Rep header strip */}
      <div className="shrink-0 flex items-center gap-3 px-4 md:px-6 py-2.5 border-b border-black/[0.06]">
        <div className="h-10 w-10 rounded-full bg-black/5" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-32 rounded bg-black/5" />
          <div className="h-2.5 w-44 rounded bg-black/5" />
        </div>
      </div>

      {/* Message bubbles */}
      <div className="flex-1 px-4 md:px-6 py-4 space-y-3">
        {[
          { mine: false, w: "w-2/3" },
          { mine: true, w: "w-1/2" },
          { mine: false, w: "w-3/4" },
          { mine: true, w: "w-1/3" },
          { mine: false, w: "w-1/2" },
        ].map((m, i) => (
          <div key={i} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div className={`h-9 ${m.w} rounded-2xl bg-black/5`} />
          </div>
        ))}
      </div>

      {/* Composer skeleton */}
      <div className="shrink-0 border-t border-black/[0.06] pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+64px)] md:pb-3">
        <div className="px-4 md:px-6 pb-2 flex gap-2">
          <div className="h-7 w-28 rounded-full bg-black/5" />
          <div className="h-7 w-24 rounded-full bg-black/5" />
          <div className="h-7 w-32 rounded-full bg-black/5" />
        </div>
        <div className="flex items-end gap-2 px-3 md:px-6 pt-1">
          <div className="flex-1 h-10 rounded-2xl bg-black/5" />
          <div className="h-10 w-10 rounded-full bg-black/5" />
        </div>
      </div>
    </div>
  );
}
