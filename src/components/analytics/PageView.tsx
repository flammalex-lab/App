"use client";

import { useEffect } from "react";
import { track, type TrackProps } from "@/lib/analytics/track";

/**
 * Drop-in `<PageView event="..." />` for tracking page mounts from
 * server components without converting the whole page to a client
 * component. Fires once on mount (per route navigation) and re-fires if
 * the event name or properties change — typically they don't.
 *
 * Use when you just need a "this page was viewed" signal. For richer
 * interactions, wire `track()` calls directly from the relevant client
 * component.
 */
export function PageView({
  event,
  properties,
}: {
  event: string;
  properties?: TrackProps;
}) {
  useEffect(() => {
    track(event, properties ?? {});
    // Properties object identity is intentionally ignored — callers
    // usually inline an object literal that would otherwise re-fire
    // every render. The properties value is captured on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);
  return null;
}
