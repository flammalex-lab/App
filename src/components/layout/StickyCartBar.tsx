"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart/store";
import { countdown, money } from "@/lib/utils/format";
import { useScrollHidden } from "./ScrollHideHeader";

interface SerializedNextDelivery {
  deliveryDate: string;
  cutoffAt: string;
  deliveryDayName: string;
}

/**
 * Floating cart pill (mobile) / footer cart bar (desktop). Visible when
 * cart has ≥1 line and the user isn't already on /cart.
 *
 * Mobile positioning: sits 10px above the tab bar's top edge with the
 * home-indicator safe area absorbed inside the tab bar itself. When the
 * tab bar slides off (scroll-down), the pill drops into the freed slot
 * so it stays thumb-reachable.
 *
 * Sets `--sticky-cart-h` on :root while visible so `Toast` can offset
 * upward (avoids a toast-vs-cart-bar collision).
 */
export function StickyCartBar({ next }: { next?: SerializedNextDelivery | null }) {
  const pathname = usePathname();
  const lines = useCart((s) => s.lines);

  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);
  const total = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

  const onCartPage = pathname?.startsWith("/cart");
  const navHidden = useScrollHidden();
  const visible = lines.length > 0 && !onCartPage;

  // Expose own height as a CSS var so toasts can offset above the bar.
  // ~60px = ~50px pill + ~10px breathing room. Set on :root so any
  // fixed-positioned element can read it.
  useEffect(() => {
    if (!visible) return;
    document.documentElement.style.setProperty("--sticky-cart-h", "60px");
    return () => {
      document.documentElement.style.removeProperty("--sticky-cart-h");
    };
  }, [visible]);

  if (!visible) return null;

  const cutoffLabel = next ? cutoffMicrocopy(next) : null;

  return (
    <div
      className={`fixed inset-x-0 z-20 px-3 md:px-6 pointer-events-none transition-[bottom] duration-200 md:bottom-6 ${
        navHidden
          ? "bottom-[calc(env(safe-area-inset-bottom,0px)+0.625rem)]"
          : "bottom-[calc(env(safe-area-inset-bottom,0px)+3.75rem)]"
      }`}
    >
      <div className="mx-auto max-w-screen-md md:max-w-2xl pointer-events-auto">
        <Link
          href="/cart"
          className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-brand-blue text-white shadow-floating hover:bg-brand-blue-dark focus:outline-none focus:ring-2 focus:ring-brand-blue/40 transition-colors duration-150 active:scale-[0.98] animate-slide-up"
        >
          <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-md bg-white/20 text-xs font-bold tabular">
            {itemCount}
          </span>
          <span className="flex-1 min-w-0 leading-tight">
            <span className="block text-sm font-semibold tabular">
              Cart · {money(total)}
            </span>
            {cutoffLabel ? (
              <span className="block text-[11px] text-white/80 tabular truncate">
                {cutoffLabel}
              </span>
            ) : null}
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-bold shrink-0">
            View
            <ArrowIcon />
          </span>
        </Link>
      </div>
    </div>
  );
}

function cutoffMicrocopy(next: SerializedNextDelivery): string | null {
  const ms = new Date(next.cutoffAt).getTime() - Date.now();
  if (ms <= 0) return "Cutoff passed";
  return `${next.deliveryDayName.slice(0, 3)} cutoff in ${countdown(ms)}`;
}

function ArrowIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
