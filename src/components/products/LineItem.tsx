"use client";

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

/**
 * Canonical order-line row used by cart, cart review, and order detail.
 * Three modes trade a few visual bits:
 *   - edit:    −/qty/+ controls on the right; no line total
 *   - review:  qty badge left; line total right; read-only
 *   - history: qty badge left; sku + variant + line total; read-only
 *
 * Callers hand in a normalized LineItemData so the same component can
 * consume either a CartLine (Zustand) or an OrderItem (DB row).
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
  const priceLine = (
    <>
      {data.packSize ? `${data.packSize} · ` : ""}
      <span className="tabular">
        {money(data.unitPrice)} / {data.unit}
      </span>
      {data.priceByWeight ? <span className="ml-1 text-accent-gold">· est.</span> : null}
    </>
  );

  return (
    <div className={`p-3 flex items-start gap-3 ${disabled ? "opacity-60" : ""}`}>
      {mode !== "edit" ? (
        <div className="h-8 w-8 shrink-0 rounded-md bg-bg-secondary text-ink-secondary flex items-center justify-center tabular text-xs font-semibold">
          {data.quantity}
        </div>
      ) : null}

      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm flex items-center gap-2">
          <span className="truncate">{data.name}</span>
          {disabled ? <span className="badge badge-gold shrink-0">Paused</span> : null}
        </div>
        <div className="text-xs text-ink-secondary">
          {mode === "history" ? (
            <>
              <span className="tabular">
                {data.sku ?? "—"}
                {data.variantLabel ? ` · ${data.variantLabel}` : ""}
              </span>
              <span className="block uppercase text-[10px] tracking-wide text-ink-tertiary">
                {data.packSize ?? data.unit}
              </span>
              <span className="block">{priceLine}</span>
            </>
          ) : (
            priceLine
          )}
        </div>
        {data.notes ? (
          <div className="text-[11px] text-ink-tertiary italic mt-1">“{data.notes}”</div>
        ) : null}
      </div>

      {mode === "edit" && onQty ? (
        <div className="shrink-0 flex items-center gap-1">
          <button
            onClick={() => onQty(data.quantity - 1)}
            disabled={disabled}
            className="h-9 w-9 rounded-full border border-black/10 flex items-center justify-center hover:bg-bg-secondary focus:outline-none focus:ring-2 focus:ring-brand-blue/40 disabled:opacity-40"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <div className="min-w-[56px] px-2 py-1.5 text-center border border-black/10 rounded-md bg-white">
            <span className="tabular text-sm font-semibold block leading-none">{data.quantity}</span>
            <span className="text-[10px] text-ink-secondary uppercase tracking-wide">{data.unit}</span>
          </div>
          <button
            onClick={() => onQty(data.quantity + 1)}
            disabled={disabled}
            className="h-9 w-9 rounded-full bg-brand-blue text-white flex items-center justify-center hover:bg-brand-blue-dark focus:outline-none focus:ring-2 focus:ring-brand-blue/40 disabled:opacity-40"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
      ) : null}

      {showTotal ? (
        <div className="tabular text-sm font-semibold shrink-0">{money(lineTotal)}</div>
      ) : null}

      {onRemove && mode === "edit" ? (
        <button
          onClick={onRemove}
          className="text-xs text-feedback-error underline shrink-0"
        >
          remove
        </button>
      ) : null}
    </div>
  );
}
