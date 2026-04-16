"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Account } from "@/lib/supabase/types";

/**
 * Top-bar account selector (Pepper-style). Shows the active account's name
 * with a caret; opens a bottom-sheet / popover listing every account the
 * buyer is a member of. For single-membership buyers, renders as static
 * text — no chrome, no chevron.
 */
export function AccountSwitcher({
  active,
  memberships,
}: {
  active: Account;
  memberships: Account[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const multi = memberships.length > 1;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function pick(accountId: string) {
    if (accountId === active.id) {
      setOpen(false);
      return;
    }
    setSwitching(accountId);
    const res = await fetch("/api/account/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    });
    setSwitching(null);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else {
      alert("Could not switch account");
    }
  }

  if (!multi) {
    return (
      <span className="font-semibold text-sm truncate max-w-[60vw]" title={active.name}>
        {active.name}
      </span>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 font-semibold text-sm truncate max-w-[60vw] hover:text-brand-blue transition"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="truncate">{active.name}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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
            aria-label="Switch account"
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl animate-slide-up"
          >
            <div className="px-5 pt-4 pb-2 flex items-center justify-between border-b border-black/5">
              <div className="display text-lg">Your accounts</div>
              <button
                onClick={() => setOpen(false)}
                className="text-sm text-ink-secondary hover:text-ink-primary"
              >
                Close
              </button>
            </div>
            <ul className="max-h-[60vh] overflow-y-auto">
              {memberships.map((a) => {
                const isActive = a.id === active.id;
                return (
                  <li key={a.id}>
                    <button
                      onClick={() => pick(a.id)}
                      disabled={switching !== null}
                      className={`w-full flex items-center gap-3 px-5 py-3 text-left border-b border-black/5 transition ${
                        isActive ? "bg-brand-blue-tint" : "hover:bg-bg-secondary"
                      }`}
                    >
                      <span className="h-9 w-9 rounded-full bg-accent-gold/30 text-[#6a4d06] inline-flex items-center justify-center display text-sm shrink-0">
                        {a.name[0]?.toUpperCase() ?? "?"}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium truncate">{a.name}</span>
                        {a.city ? (
                          <span className="block text-xs text-ink-secondary truncate">
                            {a.city}
                            {a.state ? `, ${a.state}` : ""}
                          </span>
                        ) : null}
                      </span>
                      {isActive ? (
                        <span className="text-xs font-medium text-brand-blue">Active</span>
                      ) : switching === a.id ? (
                        <span className="text-xs text-ink-secondary">Switching…</span>
                      ) : null}
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
