"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export type SortKey = "name" | "name_desc" | "price_asc" | "price_desc" | "best";

const OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name",       label: "Name A–Z" },
  { key: "name_desc",  label: "Name Z–A" },
  { key: "price_asc",  label: "Price — low to high" },
  { key: "price_desc", label: "Price — high to low" },
  { key: "best",       label: "Most popular" },
];

/**
 * Pepper-style sort trigger: button → bottom sheet. Updates the `sort`
 * query param so the server re-renders sorted results.
 */
export function SortSheet({ current }: { current: SortKey }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const currentLabel = OPTIONS.find((o) => o.key === current)?.label ?? "Name A–Z";

  function pick(next: SortKey) {
    const params = new URLSearchParams(Array.from(sp.entries()));
    params.set("sort", next);
    router.push(`/catalog?${params.toString()}`);
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-black/10 bg-white text-xs hover:bg-bg-secondary transition"
      >
        <span className="text-ink-secondary">Sort:</span>
        <span className="font-medium">{currentLabel}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center sm:justify-center"
          onClick={() => setOpen(false)}
        >
          <div
            ref={sheetRef}
            role="dialog"
            aria-label="Sort list by"
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl animate-slide-up"
          >
            <div className="px-5 pt-4 pb-2 flex items-center justify-between border-b border-black/5">
              <div className="display text-lg">Sort list by</div>
              <button
                onClick={() => setOpen(false)}
                className="text-sm text-ink-secondary hover:text-ink-primary"
              >
                Close
              </button>
            </div>
            <ul className="max-h-[60vh] overflow-y-auto">
              {OPTIONS.map((opt) => {
                const isActive = opt.key === current;
                return (
                  <li key={opt.key}>
                    <button
                      onClick={() => pick(opt.key)}
                      className={`w-full text-left px-5 py-3 border-b border-black/5 transition ${
                        isActive ? "bg-brand-blue-tint font-medium" : "hover:bg-bg-secondary"
                      }`}
                    >
                      {opt.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
