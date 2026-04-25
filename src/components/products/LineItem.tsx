"use client";

import { useRef, useState } from "react";
import { money } from "@/lib/utils/format";

export interface LineItemData {
  id: string;
  name: string;
  sku?: string | null;
  variantLabel?: string | null;
  packSize?: string | null;
  unit: string;
  unitPrice: number;
  quantity: number;
  lineTotal?: number;
  notes?: string | null;
  priceByWeight?: boolean;
  /** Product is no longer available — render disabled + "Paused" badge. */
  paused?: boolean;
}

type Mode = "edit" | "review" | "history";

const SWIPE_REVEAL = 96; // px — width of the revealed Remove action
const SWIPE_THRESHOLD = 48; // drag past this to snap open

/**
 * Canonical order-line row used by cart, cart review, and order detail.
 * Three modes trade a few visual bits:
 *   - edit:    −/qty/+ controls; swipe-left to reveal Remove
 *   - review:  qty badge left; line total right; read-only
 *   - history: qty badge left; sku + variant + line total; read-only
 */
export function LineItem({
  data,
  mode,
  onQty,
  onRemove,
}: {
  data: LineItemData;
  mode: Mode;
  onQty?: (next: number) => void;
  onRemove?: () => void;
}) {
  const showTotal = mode !== "edit";
  const lineTotal = data.lineTotal ?? data.unitPrice * data.quantity;
  const disabled = Boolean(data.paused);

  // ── Swipe-to-reveal-Remove (edit mode only) ─────────────────────────
  const [dragX, setDragX] = useState(0); // negative when dragged left
  const [revealed, setRevealed] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const axis = useRef<"horizontal" | "vertical" | null>(null);
  const enableSwipe = mode === "edit" && Boolean(onRemove);

  function onTouchStart(e: React.TouchEvent) {
    if (!enableSwipe) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    axis.current = null;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!enableSwipe || startX.current == null || startY.current == null) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    // Lock axis on first movement so a vertical scroll doesn't trigger swipe
    if (axis.current == null && Math.max(Math.abs(dx), Math.abs(dy)) > 6) {
      axis.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
    }
    if (axis.current !== "horizontal") return;
    const base = revealed ? -SWIPE_REVEAL : 0;
    // Allow leftward (negative) movement; clamp at -SWIPE_REVEAL.
    // Allow rightward only when already revealed (snap back).
    const next = Math.min(0, Math.max(-SWIPE_REVEAL, base + dx));
    setDragX(next);
  }
  function onTouchEnd() {
    if (!enableSwipe) return;
    const open = dragX <= -SWIPE_THRESHOLD;
    setRevealed(open);
    setDragX(open ? -SWIPE_REVEAL : 0);
    startX.current = null;
    startY.current = null;
    axis.current = null;
  }

  function tapRemove() {
    setRevealed(false);
    setDragX(0);
    onRemove?.();
  }

  const priceLine = (
    <>
      {data.packSize ? `${data.packSize} · ` : ""}
      <span className="tabular">
        {money(data.unitPrice)} / {data.unit}
      </span>
      {data.priceByWeight ? <span className="ml-1 text-accent-gold">· est.</span> : null}
    </>
  );

  const content = (
    <div className={`p-3 flex items-start gap-3 bg-white ${disabled ? "opacity-60" : ""}`}>
      {mode !== "edit" ? (
        <div className="h-9 w-9 shrink-0 rounded-md bg-bg-secondary text-ink-secondary flex items-center justify-center tabular text-sm font-semibold">
          {data.quantity}
        </div>
      ) : null}

      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[15px] flex items-center gap-2 leading-snug">
          <span className="truncate">{data.name}</span>
          {disabled ? (
            <span className="badge badge-gold shrink-0">Paused</span>
          ) : null}
        </div>
        {/* Variant label (e.g. "Case of 16", "Half-gallon") gets its own
            visible chip so buyers with multiple variants of the same
            product can scan which is which without parsing prose. */}
        {data.variantLabel ? (
          <div className="mt-0.5 inline-flex items-center text-[11px] font-medium uppercase tracking-wider text-brand-green-dark bg-brand-green-tint rounded-full px-2 py-0.5">
            {data.variantLabel}
          </div>
        ) : null}
        <div className="text-[13px] text-ink-secondary mt-0.5">
          {mode === "history" ? (
            <>
              <span className="tabular">
                {data.sku ?? "—"}
              </span>
              <span className="block uppercase text-[11px] tracking-wide text-ink-tertiary">
                {data.packSize ?? data.unit}
              </span>
              <span className="block">{priceLine}</span>
            </>
          ) : (
            priceLine
          )}
        </div>
        {data.notes ? (
          <div className="text-[12px] text-ink-tertiary italic mt-1">
            “{data.notes}”
          </div>
        ) : null}
      </div>

      {mode === "edit" && onQty ? (
        <div className="shrink-0 flex items-center gap-1">
          <button
            onClick={() => onQty(data.quantity - 1)}
            disabled={disabled}
            className="h-9 w-9 rounded-full border border-black/10 flex items-center justify-center hover:bg-bg-secondary focus:outline-none focus:ring-2 focus:ring-brand-blue/40 disabled:opacity-40 transition-colors duration-150"
            aria-label="Decrease quantity"
          >
            <span className="text-base leading-none">−</span>
          </button>
          <div className="min-w-[56px] px-2 py-1.5 text-center border border-black/10 rounded-md bg-white">
            <span className="tabular text-sm font-semibold block leading-none">{data.quantity}</span>
            <span className="text-[10px] text-ink-secondary uppercase tracking-wide">{data.unit}</span>
          </div>
          <button
            onClick={() => onQty(data.quantity + 1)}
            disabled={disabled}
            className="h-9 w-9 rounded-full bg-brand-blue text-white flex items-center justify-center hover:bg-brand-blue-dark focus:outline-none focus:ring-2 focus:ring-brand-blue/40 disabled:opacity-40 transition-colors duration-150"
            aria-label="Increase quantity"
          >
            <span className="text-base leading-none">+</span>
          </button>
        </div>
      ) : null}

      {showTotal ? (
        <div className="tabular text-sm font-semibold shrink-0">{money(lineTotal)}</div>
      ) : null}
    </div>
  );

  if (!enableSwipe) {
    return content;
  }

  return (
    <div className="relative overflow-hidden">
      {/* Revealed Remove action behind the row */}
      <button
        onClick={tapRemove}
        aria-label="Remove from cart"
        className="absolute right-0 inset-y-0 w-24 bg-feedback-error text-white text-sm font-semibold flex items-center justify-center hover:bg-[#a22a1f] focus:outline-none focus:ring-2 focus:ring-feedback-error focus:ring-inset transition-colors duration-150"
      >
        Remove
      </button>
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${dragX}px)`,
          transition:
            startX.current === null
              ? "transform 200ms cubic-bezier(.2,.8,.2,1)"
              : "none",
        }}
        className="relative"
      >
        {content}
      </div>
    </div>
  );
}
