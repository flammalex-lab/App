"use client";

import { useEffect, useRef, useState } from "react";
import { BottomSheet } from "./BottomSheet";

/**
 * Bottom-sheet number pad for setting a quantity directly. Solves the
 * "add 48 of these" problem — instead of tapping + 48 times the buyer
 * taps the qty digit on a stepper, types the number, hits Set.
 *
 * Behaves like an Uber Eats / Walmart cart qty editor: big readable
 * display at top, 3×4 keypad below, optional unit hint, +1/+10/+100
 * shortcut chips for common bulk amounts.
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
  /** "ea", "case", "lb" — appended after the digits for context */
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

  return (
    <BottomSheet open={open} onClose={onClose} title="Set quantity" desktopMaxWidth="22rem">
      <div className="px-5 pt-3 pb-5">
        {productName ? (
          <div className="text-center mb-3">
            <div className="text-[15px] font-medium leading-snug truncate">
              {productName}
            </div>
            {packLabel ? (
              <div className="text-[12px] text-ink-secondary mt-0.5">{packLabel}</div>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-baseline justify-center gap-2 mb-3">
          <span className="display tabular text-5xl font-semibold leading-none">
            {display}
          </span>
          {unitHint ? (
            <span className="text-[14px] text-ink-secondary uppercase tracking-wide">
              {unitHint}
            </span>
          ) : null}
        </div>

        <div className="flex justify-center gap-1.5 mb-4">
          {[1, 10, 100].map((b) => (
            <button
              key={b}
              onClick={() => bump(b)}
              className="px-3 h-8 rounded-full bg-bg-secondary text-[13px] font-medium hover:bg-black/[0.06] transition-colors duration-150"
            >
              +{b}
            </button>
          ))}
          <button
            onClick={clear}
            className="px-3 h-8 rounded-full bg-bg-secondary text-[13px] font-medium hover:bg-black/[0.06] transition-colors duration-150"
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
          <PadButton onClick={() => bump(-1)} aria-label="Minus one">
            −
          </PadButton>
          <PadButton onClick={() => press("0")}>0</PadButton>
          <PadButton onClick={back} aria-label="Backspace">
            ⌫
          </PadButton>
        </div>

        <button
          onClick={commit}
          className="btn-primary w-full mt-4 h-12 text-[15px]"
        >
          Set
        </button>
      </div>
    </BottomSheet>
  );
}

function PadButton({
  onClick,
  children,
  ...rest
}: {
  onClick: () => void;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      onClick={onClick}
      className="h-14 rounded-xl bg-bg-secondary hover:bg-black/[0.06] text-2xl font-medium tabular transition-colors duration-150 active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
      {...rest}
    >
      {children}
    </button>
  );
}
