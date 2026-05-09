import type { StandingOrder } from "@/lib/supabase/types";
import { DAY_NAMES } from "@/lib/constants";
import { dateAtZoneTime, partsInTz } from "@/lib/utils/timezone";

/**
 * Given a standing order's days_of_week + last_run_date + frequency,
 * return the next date it should run, or null if paused/inactive.
 *
 * Pass `tz` (IANA) to do arithmetic in the business zone rather than
 * server-local time. Tests omit `tz` and get the legacy local-tz path.
 */
export function computeNextRun(
  so: Pick<StandingOrder, "days_of_week" | "frequency" | "last_run_date" | "pause_until" | "active">,
  now: Date = new Date(),
  tz?: string,
): Date | null {
  if (!so.active) return null;
  if (so.pause_until && new Date(so.pause_until) > now) return null;
  if (!so.days_of_week.length) return null;

  const dayIdx = so.days_of_week
    .map((d) => DAY_NAMES.indexOf(d as (typeof DAY_NAMES)[number]))
    .filter((i) => i >= 0);
  if (!dayIdx.length) return null;

  // "startFrom" = today's 6am wall-clock; if that's already passed,
  // start from tomorrow's 6am instead.
  let startFrom: Date;
  if (tz) {
    const t = partsInTz(now, tz);
    startFrom = dateAtZoneTime(t.year, t.month, t.day, 6, 0, tz);
    if (startFrom.getTime() <= now.getTime()) {
      // Day overflow normalizes via Date.UTC inside dateAtZoneTime.
      startFrom = dateAtZoneTime(t.year, t.month, t.day + 1, 6, 0, tz);
    }
  } else {
    startFrom = new Date(now);
    startFrom.setHours(6, 0, 0, 0); // run-time: 6am
    if (startFrom <= now) startFrom.setDate(startFrom.getDate() + 1);
  }

  // Look ahead 30 days for biweekly (covers two cycles), 14 for weekly.
  const limit = so.frequency === "biweekly" ? 30 : 14;
  for (let offset = 0; offset <= limit; offset++) {
    let candidate: Date;
    let candidateDow: number;
    if (tz) {
      const sp = partsInTz(startFrom, tz);
      candidate = dateAtZoneTime(sp.year, sp.month, sp.day + offset, 6, 0, tz);
      candidateDow = partsInTz(candidate, tz).weekday;
    } else {
      candidate = new Date(startFrom);
      candidate.setDate(candidate.getDate() + offset);
      candidateDow = candidate.getDay();
    }
    if (!dayIdx.includes(candidateDow)) continue;
    if (so.frequency === "biweekly" && so.last_run_date) {
      const daysSince = Math.floor(
        (candidate.getTime() - new Date(so.last_run_date).getTime()) / 86_400_000,
      );
      if (daysSince < 14) continue;
    }
    return candidate;
  }
  return null;
}
