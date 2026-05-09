import type { StandingOrder } from "@/lib/supabase/types";
import { DAY_NAMES } from "@/lib/constants";

/**
 * Given a standing order's days_of_week + last_run_date + frequency,
 * return the next date it should run, or null if paused/inactive.
 */
export function computeNextRun(
  so: Pick<StandingOrder, "days_of_week" | "frequency" | "last_run_date" | "pause_until" | "active">,
  now: Date = new Date(),
): Date | null {
  if (!so.active) return null;
  if (so.pause_until && new Date(so.pause_until) > now) return null;
  if (!so.days_of_week.length) return null;

  const dayIdx = so.days_of_week
    .map((d) => DAY_NAMES.indexOf(d as (typeof DAY_NAMES)[number]))
    .filter((i) => i >= 0);
  if (!dayIdx.length) return null;

  const startFrom = new Date(now);
  startFrom.setHours(6, 0, 0, 0); // run-time: 6am
  if (startFrom <= now) startFrom.setDate(startFrom.getDate() + 1);

  // Look ahead 30 days for biweekly to span two cycles, 14 days for weekly.
  // Biweekly cadence is enforced day-by-day by the daysSince guard below.
  const limit = so.frequency === "biweekly" ? 30 : 14;
  for (let offset = 0; offset <= limit; offset++) {
    const candidate = new Date(startFrom);
    candidate.setDate(candidate.getDate() + offset);
    if (!dayIdx.includes(candidate.getDay())) continue;
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
