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
): NextDelivery | null {
  if (!zone.delivery_days.length) return null;

  const deliveryDayIndices = zone.delivery_days
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
