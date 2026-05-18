"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderGuide } from "@/lib/supabase/types";
import { track } from "@/lib/analytics/track";
import { NewListSheet } from "./NewListSheet";
import { RenameListSheet } from "./RenameListSheet";

interface Props {
  guides: OrderGuide[];
  activeGuideId: string | null;
}

/**
 * Header dropdown for picking the active order guide. When the buyer
 * has only one guide (the default) we render NOTHING — the multi-list
 * UI shouldn't clutter the experience for buyers who only need their
 * primary rhythm list. Two or more guides flips on the switcher chip.
 *
 * Layout: a quiet "current list ▾" chip; clicking opens a dropdown with
 * the other guides and a "+ New list" action. Each non-default row in
 * the dropdown has an inline Rename + Delete affordance for fast
 * management without a separate settings page.
 */
export function ListSwitcher({ guides, activeGuideId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<OrderGuide | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close the popover on outside click.
  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  // Hide entirely when there's only the default list — no clutter.
  if (guides.length <= 1) {
    // Single-list buyers can still create a second one, but expose that
    // only via a quiet "+ New list" chip rather than a full switcher.
    return (
      <>
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className="text-[11px] uppercase tracking-wider text-ink-tertiary hover:text-brand-blue transition-colors font-medium"
        >
          + New list
        </button>
        <NewListSheet
          open={newOpen}
          onClose={() => setNewOpen(false)}
          onCreated={(id) => {
            setNewOpen(false);
            router.push(`/guide?list=${id}`);
            router.refresh();
          }}
        />
      </>
    );
  }

  const active = guides.find((g) => g.id === activeGuideId) ?? guides[0];

  async function handleDelete(g: OrderGuide) {
    if (g.is_default) return;
    const confirmed =
      typeof window === "undefined"
        ? false
        : window.confirm(
            `Delete "${g.name}"? Items in this list will be removed, but products stay in any other lists they're in.`,
          );
    if (!confirmed) return;
    setBusyId(g.id);
    try {
      const res = await fetch(`/api/lists/${g.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        window.alert(`Delete failed: ${body.error ?? res.statusText}`);
        return;
      }
      // If we just deleted the active list, fall back to the default.
      if (g.id === active.id) {
        router.push("/guide");
      } else {
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-black/10 bg-white text-[12px] text-ink-primary hover:bg-bg-secondary transition-colors"
      >
        <span className="font-medium truncate max-w-[12rem]">{active.name}</span>
        <span aria-hidden className="text-ink-tertiary text-[10px]">▾</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 mt-1.5 min-w-[16rem] max-w-[20rem] rounded-lg border border-black/10 bg-white shadow-floating z-30 overflow-hidden"
        >
          <ul className="py-1 max-h-[60vh] overflow-y-auto">
            {guides.map((g) => {
              const isActive = g.id === active.id;
              return (
                <li
                  key={g.id}
                  className="flex items-center gap-1 px-2 py-1 hover:bg-bg-secondary group"
                >
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={isActive}
                    onClick={() => {
                      track("guide_list_switched", {
                        from_guide_id: active.id,
                        to_guide_id: g.id,
                        is_default: g.is_default,
                      });
                      setOpen(false);
                      if (g.is_default) {
                        router.push("/guide");
                      } else {
                        router.push(`/guide?list=${g.id}`);
                      }
                      router.refresh();
                    }}
                    className={`flex-1 text-left text-[13px] px-2 py-1.5 rounded ${isActive ? "text-brand-blue font-medium" : "text-ink-primary"} truncate`}
                  >
                    {isActive ? "• " : ""}{g.name}
                    {g.is_default ? (
                      <span className="ml-1.5 text-[10px] uppercase tracking-wider text-ink-tertiary">
                        default
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    aria-label={`Rename ${g.name}`}
                    onClick={() => {
                      setOpen(false);
                      setRenameTarget(g);
                    }}
                    className="text-[11px] px-1.5 py-1 text-ink-tertiary hover:text-brand-blue rounded opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    Rename
                  </button>
                  {!g.is_default ? (
                    <button
                      type="button"
                      aria-label={`Delete ${g.name}`}
                      disabled={busyId === g.id}
                      onClick={() => handleDelete(g)}
                      className="text-[11px] px-1.5 py-1 text-ink-tertiary hover:text-accent-rust rounded opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-40"
                    >
                      Delete
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className="border-t border-black/[0.06]">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setNewOpen(true);
              }}
              className="w-full text-left text-[13px] px-4 py-2.5 hover:bg-bg-secondary text-brand-blue font-medium"
            >
              + Create new list
            </button>
          </div>
        </div>
      ) : null}

      <NewListSheet
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(id) => {
          setNewOpen(false);
          router.push(`/guide?list=${id}`);
          router.refresh();
        }}
      />

      <RenameListSheet
        guide={renameTarget}
        onClose={() => setRenameTarget(null)}
        onRenamed={() => {
          setRenameTarget(null);
          router.refresh();
        }}
      />
    </div>
  );
}
