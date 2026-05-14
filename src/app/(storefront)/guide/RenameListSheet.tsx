"use client";

import { useEffect, useRef, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { OrderGuide } from "@/lib/supabase/types";

interface Props {
  /** The list to rename. When null, the sheet is closed. */
  guide: OrderGuide | null;
  onClose: () => void;
  onRenamed: () => void;
}

/**
 * Bottom-sheet for renaming a single order guide. PATCH /api/lists/[id].
 * Works for both default and non-default lists.
 */
export function RenameListSheet({ guide, onClose, onRenamed }: Props) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Render-time sync — seed the form whenever the targeted guide changes
  // (open transition or swap). React 19's `react-hooks/set-state-in-effect`
  // disallows the equivalent useEffect form. Identity is tracked by the
  // guide id (null when closed).
  const targetId = guide?.id ?? null;
  const [lastTargetId, setLastTargetId] = useState<string | null>(targetId);
  if (lastTargetId !== targetId) {
    setLastTargetId(targetId);
    if (guide) {
      setName(guide.name);
      setError(null);
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!guide) return;
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 30);
    return () => clearTimeout(t);
  }, [guide?.id, guide]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guide) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Pick a name for the list.");
      return;
    }
    if (trimmed === guide.name) {
      // No-op rename — just close. Saves a needless round-trip.
      onClose();
      return;
    }
    if (trimmed.length > 60) {
      setError("Keep it under 60 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/lists/${guide.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Couldn't save");
        setSubmitting(false);
        return;
      }
      onRenamed();
    } catch {
      setError("Network error — try again in a moment.");
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet
      open={Boolean(guide)}
      onClose={onClose}
      title="Rename list"
      ariaLabel="Rename this list"
    >
      <form onSubmit={handleSubmit} className="px-5 pt-3 pb-5 space-y-3">
        <input
          ref={inputRef}
          type="text"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-black/10 px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
          disabled={submitting}
        />
        {error ? (
          <p className="text-[12px] text-accent-rust">{error}</p>
        ) : null}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-md border border-black/10 bg-white px-3 py-2 text-[13px] text-ink-primary hover:bg-bg-secondary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="flex-1 rounded-md bg-brand-blue px-3 py-2 text-[13px] font-medium text-white hover:brightness-110 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
