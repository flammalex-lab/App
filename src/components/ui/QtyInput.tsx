"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tappable / typeable quantity input. On mobile, focusing the input
 * pops the OS numeric keyboard (Pepper / Doordash pattern). On desktop,
 * the user just types — no modal interruption. Commits onBlur or Enter.
 *
 * Local state lets the user freely edit without firing onSet on every
 * keystroke. Empty/invalid value commits as 0 (removes the line).
 */
export function QtyInput({
  value,
  onSet,
  className,
  ariaLabel = "Quantity",
}: {
  value: number;
  onSet: (next: number) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const [local, setLocal] = useState<string>(String(value));
  const ref = useRef<HTMLInputElement>(null);

  // Sync external changes (e.g. + button) into the local view
  useEffect(() => {
    setLocal(String(value));
  }, [value]);

  function commit() {
    const n = Number(local);
    if (!Number.isFinite(n) || n < 0) {
      setLocal(String(value));
      return;
    }
    const clamped = Math.min(9999, Math.floor(n));
    if (clamped !== value) onSet(clamped);
    setLocal(String(clamped));
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={local}
      onChange={(e) => setLocal(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={commit}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      aria-label={ariaLabel}
      className={
        className ??
        "h-10 w-12 text-center tabular text-[15px] font-semibold rounded-md border border-black/15 bg-white text-ink-primary focus:outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30 transition-colors duration-150"
      }
    />
  );
}
