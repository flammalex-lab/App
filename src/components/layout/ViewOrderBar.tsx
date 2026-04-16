"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart/store";
import { money } from "@/lib/utils/format";

/**
 * Sticky "View Order · N items · $TOTAL" bar — Pepper-style, flush against
 * the bottom tab bar. Renders only when the cart has items and the user
 * isn't already on /cart (the cart page has its own checkout CTA).
 */
export function ViewOrderBar() {
  const pathname = usePathname();
  const lines = useCart((s) => s.lines);

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const itemCount = lines.reduce((s, l) => s + (l.quantity > 0 ? 1 : 0), 0);
  const hide =
    lines.length === 0 ||
    pathname.startsWith("/cart") ||
    pathname.startsWith("/guide") || // guide has its own bulk-review CTA
    pathname.startsWith("/login") ||
    pathname.startsWith("/register");

  if (hide) return null;

  // bottom-[68px] sits flush above the tab bar (which is 68px tall incl. safe-area).
  return (
    <div className="fixed bottom-[68px] inset-x-0 z-20 pointer-events-none">
      <div className="max-w-3xl mx-auto pointer-events-auto">
        <Link
          href="/cart"
          className="flex items-center justify-between bg-brand-blue-dark text-white text-sm font-medium px-5 py-3 shadow-sticky hover:bg-brand-blue transition"
        >
          <span>
            View Order
            <span className="text-white/60 mx-1">·</span>
            <span>{itemCount} {itemCount === 1 ? "item" : "items"}</span>
          </span>
          <span className="mono font-semibold">{money(subtotal)}</span>
        </Link>
      </div>
    </div>
  );
}
