"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tracks scroll direction and returns a boolean for "should this bar hide".
 * Used by StoreNav so the top header and bottom tab bar can both slide
 * off-screen when scrolling down past the fold, and slide back in on
 * any scroll-up. Mobile-only: callers gate the slide off via Tailwind
 * responsive classes (md:!translate-y-0) so desktop stays pinned.
 *
 * Returns true when content has scrolled past 80px AND the user is
 * scrolling DOWN by ≥6px. Resets to false on any meaningful scroll-up
 * (≤−4px) or when scrollY drops below 40px.
 */
export function useScrollHidden(): boolean {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      const dy = y - lastY.current;
      if (y > 80 && dy > 6) setHidden(true);
      else if (dy < -4 || y < 40) setHidden(false);
      lastY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return hidden;
}

/**
 * Wrapper kept for backwards compatibility — wraps children in a div
 * that translates up when scrolling down. Use the hook directly for
 * fixed-position bars (transforming a wrapper of a position:fixed
 * child breaks the containing block).
 */
export function ScrollHideHeader({ children }: { children: React.ReactNode }) {
  const hidden = useScrollHidden();
  return (
    <div
      className={`sticky top-0 z-30 transition-transform duration-200 will-change-transform md:!translate-y-0 ${hidden ? "-translate-y-full" : ""}`}
    >
      {children}
    </div>
  );
}
