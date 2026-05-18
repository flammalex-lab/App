"use client";

import { useCart } from "@/lib/cart/store";
import { money } from "@/lib/utils/format";
import { track } from "@/lib/analytics/track";

interface LastOrder {
  id: string;
  order_number: string;
  total: number;
  item_count: number;
  /** Parsed weekday + month + day, e.g. "Fri May 1". Pre-formatted on
   *  the server so date parsing stays consistent (date-only strings are
   *  local-calendar dates — see lib/utils/format). */
  deliveryLabel: string | null;
}

/**
 * Brand-blue primary CTA for buyers landing on /guide with an empty cart.
 * Pre-fills the cart with the most recent order via the existing
 * /api/orders/reorder endpoint.
 *
 * Hidden when the cart already has items — a buyer mid-edit shouldn't see
 * a "Reorder last" affordance that would compete with their active cart
 * (the API merges lines, but the visual prompt is wrong for that state).
 */
export function ReorderLastCard({ lastOrder }: { lastOrder: LastOrder }) {
  const hasCartItems = useCart((s) => s.lines.length > 0);
  if (hasCartItems) return null;

  const subtitle = [
    `Order ${lastOrder.order_number}`,
    lastOrder.deliveryLabel ? `delivered ${lastOrder.deliveryLabel}` : null,
    money(lastOrder.total),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="mb-3">
      <form action={`/api/orders/reorder?orderId=${lastOrder.id}`} method="post">
        <button
          type="submit"
          onClick={() =>
            track("reorder_clicked", {
              order_id: lastOrder.id,
              order_number: lastOrder.order_number,
              prior_total: lastOrder.total,
              prior_item_count: lastOrder.item_count,
            })
          }
          className="w-full rounded-xl p-4 flex items-center gap-4 text-left bg-brand-blue text-white shadow-card hover:bg-brand-blue-dark transition-colors duration-150 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-brand-blue/40"
        >
          <div className="h-12 w-12 rounded-lg bg-white/15 text-white flex items-center justify-center shrink-0">
            <RotateCcwIcon />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">Reorder last</div>
            <div className="text-xs text-white/80 mt-0.5 tabular">
              {subtitle}
            </div>
          </div>
          <span aria-hidden className="text-white/80">→</span>
        </button>
      </form>
    </section>
  );
}

function RotateCcwIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}
