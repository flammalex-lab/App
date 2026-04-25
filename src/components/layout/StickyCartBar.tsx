"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart/store";
import { money } from "@/lib/utils/format";

/**
 * Sticky cart summary that floats just above the bottom tab bar (mobile)
 * or sits at the page foot (desktop). Visible only when cart has lines
 * and the user isn't already on /cart or /cart/review (avoids stacking
 * with the cart's own checkout button).
 *
 * Pepper-style: count + total + arrow → tap goes to /cart.
 */
export function StickyCartBar() {
  const pathname = usePathname();
  const lines = useCart((s) => s.lines);

  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);
  const total = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

  const onCartPage = pathname?.startsWith("/cart");
  if (lines.length === 0 || onCartPage) return null;

  return (
    <div className="fixed inset-x-0 z-20 px-3 md:px-6 pointer-events-none bottom-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] md:bottom-6">
      <div className="mx-auto max-w-screen-md md:max-w-2xl pointer-events-auto">
        <Link
          href="/cart"
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-full bg-ink-primary text-white shadow-floating hover:bg-black focus:outline-none focus:ring-2 focus:ring-brand-blue/60 transition-colors duration-150 active:scale-[0.98] animate-slide-up"
        >
          <span className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
            <span className="text-xs text-white/70 tabular">·</span>
            <span className="text-sm font-semibold tabular">{money(total)}</span>
          </span>
          <span className="flex items-center gap-1 text-sm font-medium">
            View cart
            <span aria-hidden>→</span>
          </span>
        </Link>
      </div>
    </div>
  );
}
