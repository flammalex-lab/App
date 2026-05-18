"use client";

import { useEffect, useRef } from "react";
import { track, type TrackProps } from "./track";

/**
 * Fires `${event}` once per milestone (25/50/75/100% of page depth) the
 * buyer scrolls to during the lifetime of the calling component. Each
 * milestone fires at most once per mount, so a buyer scrolling
 * up-and-down doesn't compound.
 *
 * Pass `surface` + `extra` props that get merged into every fire so the
 * downstream query can distinguish "catalog scroll 50%" from "guide
 * scroll 50%" and read the active filter context.
 *
 * Uses passive scroll listener on window — cheap, no IntersectionObserver
 * needed since we're computing against documentElement.scrollHeight.
 * Throttled via rAF so a fast scroll doesn't fire hundreds of comparisons.
 */
export function useScrollDepth(
  event: string,
  extra: TrackProps = {},
  milestones: number[] = [25, 50, 75, 100],
): void {
  const firedRef = useRef<Set<number>>(new Set());
  const extraRef = useRef<TrackProps>(extra);
  // Mirror `extra` into a ref so the scroll handler always reads the
  // latest props without re-binding the listener on every render.
  useEffect(() => {
    extraRef.current = extra;
  });

  useEffect(() => {
    firedRef.current = new Set();
    let rafQueued = false;

    function measure() {
      rafQueued = false;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const pct = Math.min(100, Math.round(((window.scrollY) / scrollable) * 100));
      for (const m of milestones) {
        if (pct >= m && !firedRef.current.has(m)) {
          firedRef.current.add(m);
          track(event, { ...extraRef.current, milestone_pct: m });
        }
      }
    }

    function onScroll() {
      if (rafQueued) return;
      rafQueued = true;
      window.requestAnimationFrame(measure);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    // Trigger an initial measurement — a short page may already be at
    // 100% on mount without any scroll event ever firing.
    measure();
    return () => window.removeEventListener("scroll", onScroll);
    // milestones intentionally captured on mount; passing a new array
    // every render shouldn't re-bind listeners.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);
}
