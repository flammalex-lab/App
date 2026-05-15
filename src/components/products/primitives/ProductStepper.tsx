"use client";

import { QtyInput } from "@/components/ui/QtyInput";

/**
 * Standardized qty stepper. Two states:
 *
 *   qty = 0  →  single "+ Add" pill (full-width if `fullWidth`, square
 *               otherwise). Brand-blue solid.
 *   qty > 0  →  −/N/+ pill with circular brand-blue buttons (trash icon
 *               replaces "−" at qty=1 so the action reads as "remove"
 *               rather than ambiguously "decrease to 0").
 *
 * Color: brand-blue everywhere. Green is reserved for the commit
 * moment (Place order, Confirm) per the design system — never on a
 * card-level stepper, even inside the VariantPicker sheet.
 *
 * Size:
 *   - "md" (default): h-11 w-11 = 44px. iOS HIG tap target.
 *   - "sm":           h-9  w-9  = 36px. For dense list rows where a
 *     44px button would dominate. Use sparingly.
 *
 * Event handling: callers pass simple `() => void` handlers. The stepper
 * stops click propagation internally so the surrounding card's tap-to-
 * open-sheet button doesn't fire when buyers tap the stepper. Callers
 * that need the raw event can use `onAdd`/`onSub` directly — they just
 * receive a stopped-propagation event.
 */
export function ProductStepper({
  available,
  cartQty,
  onAdd,
  onSub,
  onSet,
  fullWidth,
  size = "md",
  unavailableLabel = "Unavailable",
  ariaProductName,
  alwaysExpanded = false,
}: {
  available: boolean;
  cartQty: number;
  onAdd: () => void;
  onSub: () => void;
  /** Inline qty-input commit. If omitted, the qty digit is read-only
   *  (used when a variant sheet should open instead of editing the
   *  digit directly). */
  onSet?: (next: number) => void;
  fullWidth?: boolean;
  size?: "md" | "sm";
  unavailableLabel?: string;
  /** Used to make aria-labels more specific when multiple steppers
   *  appear on the same page (e.g. stock-up sheet). */
  ariaProductName?: string;
  /** When true, render the −/N/+ trio even at qty=0 (with the −
   *  disabled). Used inside the variant picker / stock-up sheets where
   *  the buyer opened the sheet specifically to dial in a number and
   *  expects to tap the digit to type. Card-level steppers leave this
   *  off so the resting state stays "+ Add" until activated. */
  alwaysExpanded?: boolean;
}) {
  if (!available) {
    return (
      <div
        className={`${size === "md" ? "h-12" : "h-9"} flex items-center justify-center text-[12px] text-ink-tertiary`}
      >
        {unavailableLabel}
      </div>
    );
  }

  const btnSize = size === "md" ? "h-11 w-11" : "h-9 w-9";
  const inputSize =
    size === "md"
      ? "h-11 flex-1 min-w-0 max-w-[64px] text-[15px]"
      : "h-9 flex-1 min-w-0 max-w-[48px] text-[14px]";
  const iconLg = size === "md" ? "text-xl" : "text-lg";
  const gap = size === "md" ? "gap-2" : "gap-1.5";
  const wrap = fullWidth ? "w-full justify-between" : "shrink-0";

  const labelSuffix = ariaProductName ? ` for ${ariaProductName}` : "";
  const expanded = cartQty > 0 || alwaysExpanded;

  if (expanded) {
    const subDisabled = cartQty <= 0;
    return (
      <div className={`${wrap} flex items-center ${gap}`}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSub();
          }}
          disabled={subDisabled}
          className={`${btnSize} flex items-center justify-center rounded-full border-2 border-brand-blue text-brand-blue hover:bg-brand-blue-tint focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors duration-150 active:scale-[0.97] shrink-0 disabled:opacity-30 disabled:pointer-events-none`}
          aria-label={cartQty === 1 ? `Remove from cart${labelSuffix}` : `Remove one${labelSuffix}`}
        >
          {cartQty === 1 ? (
            <TrashIcon size={size === "md" ? 16 : 14} />
          ) : (
            <span className={`${iconLg} leading-none`}>−</span>
          )}
        </button>
        {onSet ? (
          <QtyInput
            value={cartQty}
            onSet={onSet}
            ariaLabel={`Quantity${labelSuffix}`}
            className={`${inputSize} text-center tabular font-semibold rounded-md border border-black/15 bg-white text-ink-primary focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/30 transition-colors duration-150`}
          />
        ) : (
          <div
            className={`${inputSize} flex items-center justify-center tabular font-semibold rounded-md border border-black/15 bg-white text-ink-primary`}
          >
            {cartQty}
          </div>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAdd();
          }}
          className={`${btnSize} flex items-center justify-center rounded-full bg-brand-blue text-white hover:bg-brand-blue-dark focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors duration-150 active:scale-[0.97] shrink-0`}
          aria-label={`Add one${labelSuffix}`}
        >
          <span className={`${iconLg} leading-none`}>+</span>
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onAdd();
      }}
      className={`${fullWidth ? "w-full" : `${btnSize} shrink-0`} ${size === "md" ? "h-11" : "h-9"} flex items-center justify-center gap-1.5 rounded-full bg-brand-blue text-white text-[14px] font-semibold hover:bg-brand-blue-dark focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors duration-150 active:scale-[0.97]`}
      aria-label={`Add to cart${labelSuffix}`}
    >
      <span className={`${iconLg} leading-none`}>+</span>
      {fullWidth ? <span>Add</span> : null}
    </button>
  );
}

function TrashIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
