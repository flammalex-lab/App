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
 * Detects when a BottomSheet has locked the body via `position: fixed`
 * (which BottomSheet does to prevent scroll-jump on open). While the
 * lock is in place, `position: sticky` on the header breaks — sticky
 * has no scrollable ancestor to anchor against, so the element flows
 * with body's negative `top` offset and slides off-screen.
 *
 * The fix: swap to `position: fixed` for the duration of the lock so
 * the header stays anchored to the viewport regardless of body's
 * artificial offset.
 */
function useBodyLocked(): boolean {
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    function update() {
      setLocked(document.body.style.position === "fixed");
    }
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.body, { attributes: true, attributeFilter: ["style"] });
    return () => obs.disconnect();
  }, []);
  return locked;
}

/**
 * Wrapper kept for backwards compatibility — wraps children in a div
 * that translates up when scrolling down. Use the hook directly for
 * fixed-position bars (transforming a wrapper of a position:fixed
 * child breaks the containing block).
 */
export function ScrollHideHeader({ children }: { children: React.ReactNode }) {
  const hidden = useScrollHidden();
  const bodyLocked = useBodyLocked();
  // Default: position: sticky (in-flow, keeps document layout sane).
  // When a BottomSheet has locked the body via position: fixed, swap
  // to position: fixed so the header stays at viewport top instead of
  // riding body's negative top offset off-screen.
  const positionClass = bodyLocked ? "fixed top-0 left-0 right-0" : "sticky top-0";
  return (
    <div
      className={`${positionClass} z-30 transition-transform duration-200 will-change-transform md:!translate-y-0 ${hidden ? "-translate-y-full" : ""}`}
    >
      {children}
    </div>
  );
}
