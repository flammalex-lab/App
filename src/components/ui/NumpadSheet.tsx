"use client";

import { useEffect, useRef, useState } from "react";
import { BottomSheet } from "./BottomSheet";

/**
 * Bottom-sheet number pad for setting a quantity directly. Solves the
 * "add 48 of these" problem — tap the qty digit on a stepper, type the
 * number, hit Set. Big readable display, +1/+10/+100 chips for fast
 * jumps, 3×4 keypad with backspace.
 */
export function NumpadSheet({
  open,
  onClose,
  initial,
  unitHint,
  productName,
  packLabel,
  onSet,
}: {
  open: boolean;
  onClose: () => void;
  initial: number;
  /** "ea", "case", "lb" — small chip under the value for context */
  unitHint?: string | null;
  productName?: string;
  packLabel?: string | null;
  onSet: (n: number) => void;
}) {
  const [value, setValue] = useState<string>(String(initial));
  const cleared = useRef(false);

  useEffect(() => {
    if (open) {
      setValue(String(initial));
      cleared.current = false;
    }
  }, [open, initial]);

  // First key press after open replaces the value rather than appending —
  // matches phone-app behavior so users don't have to backspace first.
  function press(d: string) {
    setValue((cur) => {
      const base = cleared.current ? cur : "";
      cleared.current = true;
      const next = base + d;
      // 4 digits is plenty for a single line item (9999 max)
      const sliced = next.slice(0, 4).replace(/^0+(?=\d)/, "");
      return sliced || "0";
    });
  }
  function back() {
    setValue((cur) => {
      cleared.current = true;
      const next = cur.slice(0, -1);
      return next || "0";
    });
  }
  function clear() {
    cleared.current = true;
    setValue("0");
  }
  function bump(by: number) {
    setValue((cur) => {
      cleared.current = true;
      const next = Math.max(0, Number(cur || "0") + by);
      return String(Math.min(9999, next));
    });
  }
  function commit() {
    onSet(Math.max(0, Number(value || "0")));
    onClose();
  }

  const display = value === "0" ? "0" : value;
  const cleanUnit = (unitHint ?? "").trim().toLowerCase();
  const unitLabel = cleanUnit && cleanUnit !== "each" ? cleanUnit : null;

  return (
    <BottomSheet open={open} onClose={onClose} title="Set quantity" desktopMaxWidth="22rem">
      <div className="px-5 pt-2 pb-5">
        {productName ? (
          <div className="text-center mb-4">
            <div className="text-[14px] font-medium leading-snug text-ink-primary line-clamp-1">
              {productName}
            </div>
            {packLabel ? (
              <div className="text-[12px] text-ink-secondary mt-0.5">{packLabel}</div>
            ) : null}
          </div>
        ) : null}

        {/* Big value, lowercase unit chip stacked below — readable + balanced */}
        <div className="flex flex-col items-center mb-4">
          <span className="display tabular text-[64px] font-semibold leading-none text-ink-primary">
            {display}
          </span>
          {unitLabel ? (
            <span className="mt-1.5 text-[11px] uppercase tracking-[0.15em] text-ink-secondary">
              {unitLabel}
            </span>
          ) : null}
        </div>

        <div className="flex justify-center gap-1.5 mb-3">
          {[1, 10, 100].map((b) => (
            <button
              key={b}
              onClick={() => bump(b)}
              className="px-3 h-9 rounded-full bg-bg-secondary text-[13px] font-medium text-ink-primary hover:bg-black/[0.06] transition-colors duration-150 active:scale-[0.97]"
            >
              +{b}
            </button>
          ))}
          <button
            onClick={clear}
            className="px-3 h-9 rounded-full bg-bg-secondary text-[13px] font-medium text-ink-secondary hover:bg-black/[0.06] transition-colors duration-150 active:scale-[0.97]"
          >
            Clear
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <PadButton key={d} onClick={() => press(d)}>
              {d}
            </PadButton>
          ))}
          <PadButton onClick={() => bump(-1)} aria-label="Minus one" muted>
            <span className="text-2xl leading-none">−</span>
          </PadButton>
          <PadButton onClick={() => press("0")}>0</PadButton>
          <PadButton onClick={back} aria-label="Backspace" muted>
            <BackspaceIcon />
          </PadButton>
        </div>

        <button
          onClick={commit}
          className="w-full h-12 mt-4 rounded-xl bg-brand-green-dark text-white text-[15px] font-semibold hover:bg-brand-green-dark/90 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-brand-green/40 transition-colors duration-150"
        >
          Set to {display}
          {unitLabel ? <span className="ml-1 opacity-70">{unitLabel}</span> : null}
        </button>
      </div>
    </BottomSheet>
  );
}

function PadButton({
  onClick,
  children,
  muted,
  ...rest
}: {
  onClick: () => void;
  children: React.ReactNode;
  muted?: boolean;
} & React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      onClick={onClick}
      className={`h-14 rounded-xl text-2xl font-semibold tabular transition-colors duration-150 active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-brand-blue/40 ${
        muted
          ? "bg-bg-secondary text-ink-secondary hover:bg-black/[0.06]"
          : "bg-bg-secondary text-ink-primary hover:bg-black/[0.06]"
      }`}
      {...rest}
    >
      {children}
    </button>
  );
}

function BackspaceIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="mx-auto"
    >
      <path d="M22 4H8L2 12l6 8h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z" />
      <path d="m18 9-6 6M12 9l6 6" />
    </svg>
  );
}
