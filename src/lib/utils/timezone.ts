/**
 * Tiny IANA-tz aware date helpers using only `Intl.DateTimeFormat` —
 * no extra dependency. Used by cutoff + standing-order math so we
 * compute "9am ET" correctly when running on a UTC serverless host.
 *
 * If callers don't pass a tz, the surrounding code falls back to
 * server-local-time behavior (which happens to be what the legacy
 * unit tests assume).
 */

/** Offset of the given tz from UTC at the given instant, in minutes. */
function tzOffsetMinutes(instant: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  let hour = get("hour");
  // Some Intl impls return "24" for midnight in en-US.
  if (hour === 24) hour = 0;
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
  return (asUTC - instant.getTime()) / 60_000;
}

/**
 * Build a Date representing wall-clock `year-month-day hour:minute`
 * in the given tz. Handles DST by re-checking the offset at the
 * adjusted instant — crucial for spring-forward / fall-back days.
 */
export function dateAtZoneTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string,
): Date {
  let candidate = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offset = tzOffsetMinutes(candidate, tz);
  candidate = new Date(candidate.getTime() - offset * 60_000);
  const offset2 = tzOffsetMinutes(candidate, tz);
  if (offset2 !== offset) {
    candidate = new Date(candidate.getTime() - (offset2 - offset) * 60_000);
  }
  return candidate;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/** Read year/month/day/hour/weekday in the given tz from a UTC instant. */
export function partsInTz(d: Date, tz: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  weekday: number;
} {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    weekday: "short",
  });
  const parts = dtf.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0;
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour,
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
  };
}
