"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Wraps a sticky header so it slides out of view on scroll-down past
 * a threshold and slides back in on any scroll-up. Reclaims roughly
 * 56pt of screen real estate while the user is scrolling content,
 * without losing the header on demand.
 *
 * Mobile only — on md+ the header stays pinned (desktop has plenty of
 * room and most apps don't auto-hide nav at wide widths).
 */
export function ScrollHideHeader({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      const dy = y - lastY.current;
      // Past the fold AND going down ≥ 6px → hide
      if (y > 80 && dy > 6) setHidden(true);
      // Any meaningful upward scroll → reveal
      else if (dy < -4 || y < 40) setHidden(false);
      lastY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="sticky top-0 z-30 transition-transform duration-200 will-change-transform md:!translate-y-0"
      style={{ transform: hidden ? "translateY(-100%)" : "translateY(0)" }}
    >
      {children}
    </div>
  );
}
