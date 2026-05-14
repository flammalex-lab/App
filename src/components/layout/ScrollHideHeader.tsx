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
      // Bail while a BottomSheet has body-locked the page. The lock pins
      // body at `position: fixed; top: -<scrollY>`, which makes
      // window.scrollY read as 0 synthetically. Without this guard the
      // listener fires once with `y=0, dy=-<scrollY>`, the
      // `dy < -4 || y < 40` branch runs, hidden flips false, and the
      // previously-hidden header pops back into view — instantly adding
      // 52px to the top of the layout that wasn't there before. The
      // catalog reference card behind the sheet visually jumps 52px up;
      // on close, scrollTo restores scroll, dy flips positive, header
      // animates back out over 200ms — the "revert" the buyer saw.
      // Holding the listener while data-sheet-open keeps the header's
      // pre-open state pinned across the sheet's lifecycle.
      if (document.documentElement.hasAttribute("data-sheet-open")) return;
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
 *
 * Sheet-open handling: when any BottomSheet is open, the document root
 * gets `data-sheet-open` set synchronously (see BottomSheet.tsx). That
 * triggers the .scroll-hide-header CSS override in globals.css which
 * swaps this wrapper from `position: sticky` to `position: fixed`.
 * Sticky breaks while body is locked at `top: -<scrollY>px` (sticky
 * has no scrollable ancestor to anchor against and rides body's
 * negative offset off-screen). Fixed is immune to that.
 */
export function ScrollHideHeader({ children }: { children: React.ReactNode }) {
  const hidden = useScrollHidden();
  return (
    <>
      <div
        className={`scroll-hide-header sticky top-0 z-30 transition-transform duration-200 will-change-transform md:!translate-y-0 ${hidden ? "-translate-y-full" : ""}`}
      >
        {children}
      </div>
      {/* Layout-flow placeholder. While position: sticky, the wrapper above
          reserves header-height in flow; while a BottomSheet is open the
          rescue rule in globals.css swaps it to position: fixed, which
          takes it out of flow and would let every sibling beneath shift up
          by header-height. This placeholder takes the wrapper's 52px slot
          while data-sheet-open is set so content stays put on open + close.
          Hidden by default (sticky already reserves space). */}
      <div aria-hidden className="scroll-hide-header-placeholder" />
    </>
  );
}
