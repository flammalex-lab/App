import type { DeliveryZoneRow } from "@/lib/supabase/types";
import { DAY_NAMES } from "@/lib/constants";
import { dateAtZoneTime, partsInTz } from "@/lib/utils/timezone";

export interface NextDelivery {
  deliveryDate: Date;
  cutoffAt: Date;
  msUntilCutoff: number;
  /**
   * True when the soonest upcoming delivery day was already past its
   * cutoff and we rolled forward to the next one. UI uses this to render
   * "you just missed it" copy.
   */
  pastCutoff: boolean;
  deliveryDayName: string;
}

/**
 * Resolve the effective delivery-day list for a buyer. If the account
 * has set per-account `delivery_days` (migration 0030), those override
 * the zone's defaults. Otherwise fall back to the zone schedule. This
 * lets ops give one account a narrower schedule than the rest of the
 * zone (e.g. Tuesday-only when the zone runs Tue + Fri).
 */
function effectiveDeliveryDays(
  zone: Pick<DeliveryZoneRow, "delivery_days">,
  accountOverride: string[] | null | undefined,
): string[] {
  if (accountOverride && accountOverride.length > 0) return accountOverride;
  return zone.delivery_days;
}

/**
 * Compute the next delivery date and cutoff for a given zone.
 * If the soonest delivery's cutoff has passed, roll to the next delivery
 * day and set `pastCutoff: true`.
 *
 * Pass `tz` (IANA, e.g. "America/New_York") to do all arithmetic in the
 * business zone rather than server-local time. Tests omit `tz` and get
 * the legacy local-tz behavior.
 */
export function nextDeliveryForZone(
  zone: Pick<DeliveryZoneRow, "delivery_days" | "cutoff_hours_before_delivery">,
  now: Date = new Date(),
  tz?: string,
  accountDeliveryDays?: string[] | null,
): NextDelivery | null {
  const days = effectiveDeliveryDays(zone, accountDeliveryDays);
  if (!days.length) return null;

  const deliveryDayIndices = days
    .map((d) => DAY_NAMES.indexOf(d as (typeof DAY_NAMES)[number]))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b);

  if (!deliveryDayIndices.length) return null;

  let pastCutoff = false;

  for (let offset = 0; offset < 14; offset++) {
    let candidate: Date;
    let candidateDow: number;

    if (tz) {
      // Anchor "today" wall-clock parts in the business tz, then materialize
      // (today.day + offset) at 9am in tz. dateAtZoneTime → Date.UTC
      // normalizes day overflow, so day=32 becomes the 1st of the next month.
      const today = partsInTz(now, tz);
      candidate = dateAtZoneTime(today.year, today.month, today.day + offset, 9, 0, tz);
      candidateDow = partsInTz(candidate, tz).weekday;
    } else {
      candidate = new Date(now);
      candidate.setDate(candidate.getDate() + offset);
      candidate.setHours(9, 0, 0, 0); // assume 9am delivery time
      candidateDow = candidate.getDay();
    }

    if (!deliveryDayIndices.includes(candidateDow)) continue;

    const cutoffAt = new Date(candidate.getTime() - zone.cutoff_hours_before_delivery * 3600_000);
    if (cutoffAt.getTime() > now.getTime()) {
      return {
        deliveryDate: candidate,
        cutoffAt,
        msUntilCutoff: cutoffAt.getTime() - now.getTime(),
        pastCutoff,
        deliveryDayName: DAY_NAMES[candidateDow],
      };
    }
    // Soonest match was past cutoff — note it and keep looking.
    pastCutoff = true;
  }

  return null;
}

/**
 * List the next N upcoming delivery dates for a zone whose cutoff hasn't
 * passed. Returned as `YYYY-MM-DD` strings in the business timezone so
 * the date picker can render them without any further timezone math.
 */
export function upcomingDeliveriesForZone(
  zone: Pick<DeliveryZoneRow, "delivery_days" | "cutoff_hours_before_delivery">,
  now: Date = new Date(),
  tz?: string,
  count: number = 12,
  accountDeliveryDays?: string[] | null,
): { date: string; dayName: string }[] {
  const days = effectiveDeliveryDays(zone, accountDeliveryDays);
  if (!days.length) return [];

  const deliveryDayIndices = days
    .map((d) => DAY_NAMES.indexOf(d as (typeof DAY_NAMES)[number]))
    .filter((i) => i >= 0);
  if (!deliveryDayIndices.length) return [];

  const out: { date: string; dayName: string }[] = [];
  for (let offset = 0; offset < 60 && out.length < count; offset++) {
    let candidate: Date;
    let candidateDow: number;
    let isoDate: string;

    if (tz) {
      const today = partsInTz(now, tz);
      candidate = dateAtZoneTime(today.year, today.month, today.day + offset, 9, 0, tz);
      const parts = partsInTz(candidate, tz);
      candidateDow = parts.weekday;
      isoDate = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
    } else {
      candidate = new Date(now);
      candidate.setDate(candidate.getDate() + offset);
      candidate.setHours(9, 0, 0, 0);
      candidateDow = candidate.getDay();
      isoDate = `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, "0")}-${String(candidate.getDate()).padStart(2, "0")}`;
    }

    if (!deliveryDayIndices.includes(candidateDow)) continue;
    const cutoffAt = new Date(candidate.getTime() - zone.cutoff_hours_before_delivery * 3600_000);
    if (cutoffAt.getTime() <= now.getTime()) continue;

    out.push({ date: isoDate, dayName: DAY_NAMES[candidateDow] });
  }
  return out;
}
