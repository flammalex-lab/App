"use client";

import { useEffect, useRef, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with the new list's id once the POST succeeds. */
  onCreated: (id: string) => void;
}

/**
 * Bottom-sheet for naming a new (non-default) order guide. Calls
 * POST /api/lists with { name } and surfaces server error codes inline.
 *
 * Buyer-side limits the route enforces and we mirror in the form:
 *  - non-empty name
 *  - <= 60 chars
 *  - <= 20 lists per buyer (server-side check; we just relay the error)
 */
export function NewListSheet({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset form whenever the sheet *transitions* from closed → open.
  // Render-time sync (BottomSheet uses the same pattern around
  // `lastOpen`) — React 19's `react-hooks/set-state-in-effect` rule
  // flags setState-in-effect, and there's no derivable source for
  // these resets other than the open transition itself.
  const [lastOpen, setLastOpen] = useState(open);
  if (lastOpen !== open) {
    setLastOpen(open);
    if (open) {
      setName("");
      setError(null);
      setSubmitting(false);
    }
  }

  // Autofocus the input on open. Side-effect only — no state changes
  // here, so the React 19 lint stays green.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Pick a name for the list.");
      return;
    }
    if (trimmed.length > 60) {
      setError("Keep it under 60 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
        limit?: number;
      };
      if (!res.ok || !body.id) {
        setError(humanizeError(body.error, body.limit));
        setSubmitting(false);
        return;
      }
      onCreated(body.id);
    } catch {
      setError("Network error — try again in a moment.");
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="New list" ariaLabel="Create a new list">
      <form onSubmit={handleSubmit} className="px-5 pt-3 pb-5 space-y-3">
        <label className="block text-[12px] text-ink-secondary">
          What do you want to call it?
        </label>
        <input
          ref={inputRef}
          type="text"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          placeholder="Monday prep, Catering Mar 18, …"
          className="w-full rounded-md border border-black/10 px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
          disabled={submitting}
        />
        <p className="text-[11px] text-ink-tertiary">
          Lists are personal — only you see them. Items you add here don&apos;t
          show up on the catalog &ldquo;in guide&rdquo; badge and don&apos;t feed
          your weekly draft.
        </p>
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
            {submitting ? "Creating…" : "Create list"}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}

function humanizeError(code: string | undefined, limit: number | undefined): string {
  switch (code) {
    case "missing_name":
      return "Pick a name for the list.";
    case "name_too_long":
      return "Keep it under 60 characters.";
    case "too_many_lists":
      return `You've reached the ${limit ?? 20}-list cap. Delete one to make room.`;
    case "unauthorized":
      return "Please sign in again.";
    case "invalid_json":
      return "Something glitched — try again.";
    default:
      return code ? `Couldn't create the list (${code}).` : "Couldn't create the list.";
  }
}
