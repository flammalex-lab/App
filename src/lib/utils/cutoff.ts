import type { DeliveryZoneRow } from "@/lib/supabase/types";
import { DAY_NAMES } from "@/lib/constants";

export interface NextDelivery {
  deliveryDate: Date;
  cutoffAt: Date;
  msUntilCutoff: number;
  pastCutoff: boolean;
  deliveryDayName: string;
}

/**
 * Compute the next delivery date and cutoff for a given zone.
 * If the soonest delivery's cutoff has passed, roll to the next delivery day.
 */
export function nextDeliveryForZone(
  zone: Pick<DeliveryZoneRow, "delivery_days" | "cutoff_hours_before_delivery">,
  now: Date = new Date(),
): NextDelivery | null {
  if (!zone.delivery_days.length) return null;

  const deliveryDayIndices = zone.delivery_days
    .map((d) => DAY_NAMES.indexOf(d as (typeof DAY_NAMES)[number]))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b);

  if (!deliveryDayIndices.length) return null;

  for (let offset = 0; offset < 14; offset++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(9, 0, 0, 0); // assume 9am delivery time
    if (!deliveryDayIndices.includes(candidate.getDay())) continue;

    const cutoffAt = new Date(candidate.getTime() - zone.cutoff_hours_before_delivery * 3600_000);
    if (cutoffAt.getTime() > now.getTime()) {
      return {
        deliveryDate: candidate,
        cutoffAt,
        msUntilCutoff: cutoffAt.getTime() - now.getTime(),
        pastCutoff: false,
        deliveryDayName: DAY_NAMES[candidate.getDay()],
      };
    }
  }

  return null;
}
