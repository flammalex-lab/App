"use client";

import { QtyInput } from "@/components/ui/QtyInput";

/**
 * Standardized qty stepper. Two states:
 *
 *   qty = 0  →  single "+ Add" pill (full-width if `fullWidth`, square
 *               otherwise). Brand-blue solid.
 *   qty > 0  →  segmented box stepper: a single rounded-md container
 *               with a 2px brand-blue border around three flush cells
 *               — white "−" on the left, tinted qty digit in the
 *               middle, solid brand-blue "+" on the right. The trash
 *               icon replaces "−" at qty=1 so the action reads as
 *               "remove" rather than ambiguously "decrease to 0".
 *
 * Color: brand-blue everywhere. Green is reserved for the commit
 * moment (Place order, Confirm) per the design system — never on a
 * card-level stepper, even inside the VariantPicker sheet.
 *
 * Size:
 *   - "md" (default): h-11 = 44px. iOS HIG tap target.
 *   - "sm":           h-9  = 36px. For dense list rows where a
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
  /** When true, render the segmented stepper even at qty=0 (with the −
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

  const cellH = size === "md" ? "h-11" : "h-9";
  const btnW = size === "md" ? "w-11" : "w-9";
  const iconLg = size === "md" ? "text-xl" : "text-lg";
  const digitFs = size === "md" ? "text-[15px]" : "text-[14px]";

  const labelSuffix = ariaProductName ? ` for ${ariaProductName}` : "";
  const expanded = cartQty > 0 || alwaysExpanded;

  if (expanded) {
    const subDisabled = cartQty <= 0;
    const isFilled = cartQty > 0;
    // Outer container: `overflow-hidden` clips the inner cell colors so
    // the 2px brand-blue border reads as one continuous frame; the
    // middle cell's left+right borders draw the two interior dividers.
    // Focus rings go on the outer container via focus-within so they
    // aren't clipped.
    const containerClass = fullWidth
      ? `flex w-full ${cellH} rounded-md overflow-hidden border-2 border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/40`
      : `inline-flex ${cellH} rounded-md overflow-hidden border-2 border-brand-blue shrink-0 focus-within:ring-2 focus-within:ring-brand-blue/40`;
    const middleClass = fullWidth
      ? "flex-1 min-w-0"
      : size === "md"
        ? "w-12"
        : "w-10";
    return (
      <div className={containerClass}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSub();
          }}
          disabled={subDisabled}
          className={`${btnW} shrink-0 h-full flex items-center justify-center bg-white text-brand-blue hover:bg-brand-blue-tint focus:outline-none transition-colors duration-150 disabled:opacity-30 disabled:pointer-events-none`}
          aria-label={cartQty === 1 ? `Remove from cart${labelSuffix}` : `Remove one${labelSuffix}`}
        >
          {cartQty === 1 ? (
            <TrashIcon size={size === "md" ? 16 : 14} />
          ) : (
            <span className={`${iconLg} leading-none`}>−</span>
          )}
        </button>
        <div
          className={`${middleClass} h-full flex items-center justify-center border-l-2 border-r-2 border-brand-blue ${isFilled ? "bg-brand-blue-tint" : "bg-white"}`}
        >
          {onSet ? (
            <QtyInput
              value={cartQty}
              onSet={onSet}
              ariaLabel={`Quantity${labelSuffix}`}
              className={`h-full w-full text-center tabular ${digitFs} font-semibold bg-transparent border-none focus:outline-none ${isFilled ? "text-brand-blue-dark" : "text-brand-blue"}`}
            />
          ) : (
            <span className={`tabular ${digitFs} font-semibold ${isFilled ? "text-brand-blue-dark" : "text-brand-blue"}`}>
              {cartQty}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAdd();
          }}
          className={`${btnW} shrink-0 h-full flex items-center justify-center bg-brand-blue text-white hover:bg-brand-blue-dark focus:outline-none transition-colors duration-150`}
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
      className={`${fullWidth ? "w-full" : `${btnW} shrink-0`} ${cellH} flex items-center justify-center gap-1.5 rounded-full bg-brand-blue text-white text-[14px] font-semibold hover:bg-brand-blue-dark focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors duration-150 active:scale-[0.97]`}
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
