"use client";

import { useEffect, useRef } from "react";
import { track, type TrackProps } from "@/lib/analytics/track";

/**
 * Drop-in `<PageView event="..." />` for tracking page mounts from
 * server components without converting the whole page to a client
 * component.
 *
 * Fires three events for a complete page-engagement picture:
 *   - on mount: `event` (the supplied name) with `properties`
 *   - on unmount OR visibilitychange→hidden: `${event}_left` with
 *     `{ duration_ms, hidden_at_least_once }`
 *
 * The leave-event fires at most once per mount — repeated foreground/
 * background swings within one page view don't compound. Duration is
 * measured wall-clock from mount, not active foreground time, since
 * "session duration" with foreground-only sums is its own can of worms
 * we don't need to open yet.
 */
export function PageView({
  event,
  properties,
}: {
  event: string;
  properties?: TrackProps;
}) {
  const mountedAtRef = useRef<number>(0);
  const firedLeaveRef = useRef<boolean>(false);
  const hiddenSeenRef = useRef<boolean>(false);
  useEffect(() => {
    mountedAtRef.current = performance.now();
    firedLeaveRef.current = false;
    hiddenSeenRef.current = false;
    track(event, properties ?? {});

    function fireLeave(reason: "unmount" | "hidden") {
      if (firedLeaveRef.current) return;
      firedLeaveRef.current = true;
      const duration = Math.round(performance.now() - mountedAtRef.current);
      track(`${event}_left`, {
        duration_ms: duration,
        reason,
        hidden_at_least_once: hiddenSeenRef.current,
      });
    }

    function onVis() {
      if (document.visibilityState === "hidden") {
        hiddenSeenRef.current = true;
        // Fire leave on first hide — pagehide/unload is unreliable on
        // mobile, and we want the data even if the buyer never returns.
        fireLeave("hidden");
      }
    }
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      fireLeave("unmount");
    };
    // Properties object identity is intentionally ignored — callers
    // usually inline an object literal that would otherwise re-fire
    // every render. The properties value is captured on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);
  return null;
}

