"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart/store";
import { money } from "@/lib/utils/format";

/**
 * Sticky "View Order | $X.XX" bar — Pepper-style. Renders only when the
 * cart has items AND the user isn't already on /cart (the cart page has
 * its own checkout CTA). Sits above the bottom tabs.
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

  return (
    <div className="fixed bottom-[68px] inset-x-0 z-20 px-0 pointer-events-none pb-safe">
      <div className="max-w-3xl mx-auto pointer-events-auto">
        <Link
          href="/cart"
          className="block bg-ink-primary text-white text-sm font-medium py-3.5 px-5 flex items-center justify-between hover:bg-black transition"
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
