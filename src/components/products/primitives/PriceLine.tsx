"use client";

import { money } from "@/lib/utils/format";

/**
 * Standardized price + size caption used by every product chrome variant.
 *
 * Two formats — pick the one that matches the context:
 *   - "chrome" (default): `$X.XX · size`
 *     The size already implies a unit ("Gallon", "12/6 oz", "5 lb avg").
 *     Used on cards, rows, draft lines, stock-up rows, variant picker rows.
 *     The separator auto-switches to "·" when the size contains its own
 *     slash so we don't render "$20.00 / 4 / gallon" — reads as nonsense.
 *   - "unit":  `$X.XX / unit`
 *     Used in the cart and order-detail contexts where the unit (per lb,
 *     per case, per bottle) is the buyer-meaningful denominator.
 *
 * Tone follows the design system: tabular price in primary ink, size in
 * the tertiary ink so the eye lands on the dollar amount first.
 */
export function PriceLine({
  price,
  size,
  format = "chrome",
  unit,
  weight = "medium",
  textSize = "sm",
  className,
}: {
  price: number | null | undefined;
  /** Size label (pack_size, case_pack, etc). Required for "chrome" format. */
  size?: string | null;
  /** Unit (per "lb", per "case", per "bottle"). Required for "unit" format. */
  unit?: string | null;
  format?: "chrome" | "unit";
  /** Price weight — semibold for grid cards (more prominent), medium for compact/row/draft. */
  weight?: "medium" | "semibold";
  /** Caption size — xs (12px) for compact/draft, sm (13px) for grid/row, md (14px) for detail. */
  textSize?: "xs" | "sm" | "md";
  className?: string;
}) {
  const priceStr = price != null ? money(price) : "—";
  const weightCls = weight === "semibold" ? "font-semibold" : "font-medium";
  const sizeCls =
    textSize === "xs"
      ? "text-[12px]"
      : textSize === "md"
        ? "text-[14px]"
        : "text-[13px]";

  if (format === "unit") {
    return (
      <span className={`${sizeCls} text-ink-secondary tabular ${className ?? ""}`}>
        <span className={`${weightCls} text-ink-primary`}>{priceStr}</span>
        {unit ? <span className="text-ink-tertiary"> / {unit}</span> : null}
      </span>
    );
  }

  // chrome format
  const sizeLabel = size ?? unit ?? null;
  // Middot when the size string already contains a slash ("9/10 oz",
  // "4 / gallon"); otherwise " · " separates price from size. We never
  // render "$X / 4 / gallon" — that reads as nonsense.
  return (
    <span className={`${sizeCls} text-ink-secondary tabular ${className ?? ""}`}>
      <span className={`${weightCls} text-ink-primary`}>{priceStr}</span>
      {sizeLabel ? <span className="text-ink-tertiary"> · {sizeLabel}</span> : null}
    </span>
  );
}
