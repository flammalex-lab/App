"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart/store";
import { track } from "@/lib/analytics/track";

export function CartIconWithBadge() {
  // Count is total cases across all lines so the badge matches the
  // floating "View cart" pill — otherwise the same cart appears to
  // contain two different counts depending on where you look.
  const count = useCart((s) => s.lines.reduce((n, l) => n + l.quantity, 0));
  return (
    <Link
      href="/cart"
      aria-label={`Cart (${count} ${count === 1 ? "item" : "items"})`}
      onClick={() => track("cart_icon_tapped", { item_count: count })}
      className="relative h-10 w-10 inline-flex items-center justify-center rounded-full hover:bg-bg-secondary transition"
    >
      <CartIcon />
      {count > 0 ? (
        <span className="absolute -top-0.5 -right-0.5 h-5 min-w-[20px] px-1 inline-flex items-center justify-center rounded-full bg-brand-blue text-white text-[10px] font-semibold">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}

function CartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h2.4l2.6 13.2a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.2L21 8H6" />
      <circle cx="9" cy="21" r="1.4" />
      <circle cx="18" cy="21" r="1.4" />
    </svg>
  );
}
