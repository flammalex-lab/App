"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart/store";
import { money } from "@/lib/utils/format";

/**
 * "View Order · N items · $TOTAL" strip — renders flush above the tab
 * bar (mounted INSIDE the bottom-nav container, so the two always sit
 * together with no seam). Hidden when cart is empty or on pages that
 * already have their own cart/review CTA.
 */
export function ViewOrderBar() {
  const pathname = usePathname();
  const lines = useCart((s) => s.lines);

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const itemCount = lines.reduce((s, l) => s + (l.quantity > 0 ? 1 : 0), 0);
  const hide =
    lines.length === 0 ||
    pathname.startsWith("/cart") ||
    pathname.startsWith("/guide") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register");

  if (hide) return null;

  return (
    <Link
      href="/cart"
      className="block mx-auto max-w-3xl flex items-center justify-between bg-brand-blue text-white text-sm font-medium px-5 py-3 hover:bg-brand-blue-dark transition"
    >
      <span>
        View Order
        <span className="text-white/60 mx-1">·</span>
        <span>{itemCount} {itemCount === 1 ? "item" : "items"}</span>
      </span>
      <span className="mono font-semibold">{money(subtotal)}</span>
    </Link>
  );
}
