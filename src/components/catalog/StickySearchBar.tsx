"use client";

import { useEffect, useRef, useState } from "react";
import { SearchBar } from "./SearchBar";

interface Props {
  /** Datalist id for the browser-native suggestions binding. */
  datalistId?: string;
  /** Placeholder copy. Defaults to "Search products or farms." */
  placeholder?: string;
}

/**
 * Sticky wrapper around the URL-mode `<SearchBar>`. Hoisted into
 * `catalog/layout.tsx` so the same input rides every `/catalog/*` route
 * (landing, group, sub-category, producer) without each page re-rendering
 * its own copy.
 *
 * Scroll behaviour:
 *   - `position: sticky; top: 0` so the bar pins to the top of the
 *     viewport once the buyer scrolls past the catalog hero.
 *   - A 1px sentinel sits *above* the sticky element. When the sentinel
 *     scrolls out of view we know the bar has hit its sticky edge — at
 *     that point we add a soft shadow + subtle background bleed so it
 *     reads as a distinct floating layer over the scrolling content
 *     instead of running into the catalog grid.
 *
 * z-index: z-20. Below the StoreNav header (z-30) so the nav still
 * pins above the search bar on desktop and the nav's scroll-hide on
 * mobile lets the search bar slide up underneath it. Below sheets
 * (z-50) and the cart pill (z-30) on mobile.
 */
export function StickySearchBar({ datalistId, placeholder }: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        // Sentinel out of view → bar has reached its sticky position.
        setStuck(!entry.isIntersecting);
      },
      // Negative top root margin so we trigger *before* the sentinel
      // crosses the very top edge (avoids a 1px flicker on slow
      // scrolling). intersect-with-viewport behaviour by default.
      { rootMargin: "0px 0px 0px 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinelRef} aria-hidden className="h-px -mt-px" />
      <div
        className={`sticky top-0 z-20 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 py-2 transition-all duration-150 ${
          stuck
            ? "bg-white/95 backdrop-blur-sm shadow-[0_4px_12px_rgba(22,22,22,0.06)]"
            : "bg-transparent"
        }`}
      >
        <SearchBar datalistId={datalistId} placeholder={placeholder} />
      </div>
    </>
  );
}
