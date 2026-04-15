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

  const step = so.frequency === "biweekly" ? 14 : 1;
  const limit = so.frequency === "biweekly" ? 30 : 14;
  for (let offset = 0; offset <= limit; offset += step === 14 ? 1 : 1) {
    const candidate = new Date(startFrom);
    candidate.setDate(candidate.getDate() + offset);
    if (dayIdx.includes(candidate.getDay())) {
      // enforce biweekly cadence by aligning to last_run_date
      if (so.frequency === "biweekly" && so.last_run_date) {
        const daysSince = Math.floor(
          (candidate.getTime() - new Date(so.last_run_date).getTime()) / 86_400_000,
        );
        if (daysSince < 14) continue;
      }
      return candidate;
    }
  }
  return null;
}
