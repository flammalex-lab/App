"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BottomSheet } from "@/components/ui/BottomSheet";

export type SortKey = "name" | "name_desc" | "price_asc" | "price_desc" | "best";

const OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name A–Z" },
  { key: "name_desc", label: "Name Z–A" },
  { key: "price_asc", label: "Price — low to high" },
  { key: "price_desc", label: "Price — high to low" },
  { key: "best", label: "Most popular" },
];

/**
 * Sort trigger: button → bottom sheet. Updates the `sort` query param
 * so the server re-renders sorted results. Now uses the shared
 * BottomSheet primitive (drag-to-dismiss + standard chrome).
 */
export function SortSheet({ current }: { current: SortKey }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);

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
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-black/10 bg-white text-[13px] hover:bg-bg-secondary transition-colors duration-150"
      >
        <span className="text-ink-secondary">Sort:</span>
        <span className="font-medium">{currentLabel}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Sort list by">
        <ul>
          {OPTIONS.map((opt) => {
            const isActive = opt.key === current;
            return (
              <li key={opt.key}>
                <button
                  onClick={() => pick(opt.key)}
                  className={`w-full text-left px-5 py-4 border-b border-black/[0.04] transition-colors duration-150 ${
                    isActive
                      ? "bg-brand-blue-tint font-medium"
                      : "hover:bg-bg-secondary"
                  }`}
                >
                  <span className="text-[15px]">{opt.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </BottomSheet>
    </>
  );
}
