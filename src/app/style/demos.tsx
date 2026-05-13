"use client";

// Each demo is exported individually rather than bundled into a namespace
// object. RSC's client-module barrier doesn't preserve member access on
// namespace exports from "use client" files reliably — Vercel's
// production prerender threw "Element type is invalid... got: undefined"
// on the StyleDemos.* pattern. Named exports import + render fine.
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { QtyInput } from "@/components/ui/QtyInput";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/ui/Toast";

export function LoadingButton() {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      loading={loading}
      loadingLabel="Placing order…"
      onClick={() => {
        setLoading(true);
        setTimeout(() => setLoading(false), 1400);
      }}
    >
      Trigger loading
    </Button>
  );
}

export function QtyDemo() {
  const [qty, setQty] = useState(4);
  return <QtyInput value={qty} onSet={setQty} />;
}

export function ToastTriggers() {
  const toast = useToast();
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => toast.push("Saved to your guide.", "success")}
      >
        Success toast
      </Button>
      <Button
        variant="secondary"
        onClick={() => toast.push("Couldn't reach the server.", "error")}
      >
        Error toast
      </Button>
      <Button
        variant="ghost"
        onClick={() => toast.push("Cutoff in 30 minutes.", "info")}
      >
        Info toast
      </Button>
    </>
  );
}

export function SheetTrigger() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Open bottom sheet
      </Button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Standing order · Fridays"
      >
        <div className="p-5 space-y-3 text-sm">
          <p className="text-ink-primary">
            12 cases of #2 Yellow Carrots every Friday, Zone 3.
          </p>
          <p className="text-ink-secondary">
            Edits commit at the next cutoff. Pause anytime — we&apos;ll text
            you the day before resume.
          </p>
        </div>
      </BottomSheet>
    </>
  );
}

export function MotionGrid() {
  const [version, setVersion] = useState(0);
  return (
    <div>
      <button
        onClick={() => setVersion((v) => v + 1)}
        className="btn-secondary text-sm mb-4"
      >
        Replay
      </button>
      <div key={version} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { name: "animate-fade-in", note: "200ms · ease-out" },
          { name: "animate-slide-up", note: "250ms · fluent" },
          { name: "animate-scale-in", note: "200ms · fluent" },
          { name: "animate-slide-in-right", note: "280ms · fluent" },
          { name: "animate-sheet-up", note: "280ms · fluent · mobile sheets" },
        ].map((m) => (
          <div
            key={m.name}
            className={`card p-5 ${m.name}`}
          >
            <div className="text-sm font-mono">{m.name}</div>
            <div className="text-xs text-ink-tertiary mt-1">{m.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

