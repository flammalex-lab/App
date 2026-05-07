import { nextDeliveryForZone } from "@/lib/utils/cutoff";
import type { DeliveryZoneRow } from "@/lib/supabase/types";

// Anchor dates are constructed via local-time constructors so .getDay()
// behavior (which the function uses) is consistent across runner timezones.
// April 2026 weekday reference:
//   13 = Mon, 14 = Tue, 15 = Wed, 16 = Thu, 17 = Fri, 18 = Sat, 19 = Sun

type Zone = Pick<DeliveryZoneRow, "delivery_days" | "cutoff_hours_before_delivery">;

describe("nextDeliveryForZone", () => {
  it("returns the upcoming delivery when cutoff is still ahead", () => {
    const zone: Zone = { delivery_days: ["Thursday"], cutoff_hours_before_delivery: 24 };
    const now = new Date(2026, 3, 13, 8, 0, 0); // Mon 8am
    const res = nextDeliveryForZone(zone, now)!;
    expect(res.deliveryDayName).toBe("Thursday");
    expect(res.deliveryDate.getDate()).toBe(16); // Thu Apr 16
    expect(res.deliveryDate.getHours()).toBe(9);
    expect(res.pastCutoff).toBe(false);
    expect(res.cutoffAt.getTime()).toBe(res.deliveryDate.getTime() - 24 * 3600_000);
    expect(res.msUntilCutoff).toBeGreaterThan(0);
  });

  it("rolls to the next delivery day when cutoff has already passed", () => {
    const zone: Zone = { delivery_days: ["Thursday"], cutoff_hours_before_delivery: 24 };
    // Thu 10am — delivery is today 9am, cutoff was Wed 9am — both past.
    const now = new Date(2026, 3, 16, 10, 0, 0);
    const res = nextDeliveryForZone(zone, now)!;
    expect(res.deliveryDate.getDate()).toBe(23); // next Thu
    expect(res.deliveryDayName).toBe("Thursday");
  });

  it("picks the soonest delivery day from multiple", () => {
    const zone: Zone = {
      delivery_days: ["Monday", "Thursday"],
      cutoff_hours_before_delivery: 24,
    };
    const now = new Date(2026, 3, 14, 9, 0, 0); // Tue
    const res = nextDeliveryForZone(zone, now)!;
    expect(res.deliveryDayName).toBe("Thursday");
    expect(res.deliveryDate.getDate()).toBe(16);
  });

  it("skips today's delivery if cutoff has just passed, picks the next configured day", () => {
    const zone: Zone = {
      delivery_days: ["Monday", "Thursday"],
      cutoff_hours_before_delivery: 48,
    };
    // Wed 10am — Thu 9am delivery, cutoff Tue 9am — past.
    const now = new Date(2026, 3, 15, 10, 0, 0);
    const res = nextDeliveryForZone(zone, now)!;
    // Monday is the next configured day, cutoff Sat 9am — that's ahead.
    expect(res.deliveryDayName).toBe("Monday");
    expect(res.deliveryDate.getDate()).toBe(20);
  });

  it("returns null when no delivery days are configured", () => {
    const zone: Zone = { delivery_days: [], cutoff_hours_before_delivery: 24 };
    expect(nextDeliveryForZone(zone, new Date(2026, 3, 13, 8))).toBeNull();
  });

  it("returns null when all configured days are unrecognized strings", () => {
    const zone: Zone = {
      delivery_days: ["Funday", "Notaday"],
      cutoff_hours_before_delivery: 24,
    };
    expect(nextDeliveryForZone(zone, new Date(2026, 3, 13, 8))).toBeNull();
  });

  it("ignores unrecognized day strings but keeps valid ones", () => {
    const zone: Zone = {
      delivery_days: ["Funday", "Thursday"],
      cutoff_hours_before_delivery: 24,
    };
    const res = nextDeliveryForZone(zone, new Date(2026, 3, 13, 8))!;
    expect(res.deliveryDayName).toBe("Thursday");
  });

  it("treats cutoff === now as past (strict >)", () => {
    // cutoff_hours = 24, delivery Thu 9am, cutoff Wed 9am.
    // If now is exactly Wed 9am, should roll forward.
    const zone: Zone = { delivery_days: ["Thursday"], cutoff_hours_before_delivery: 24 };
    const now = new Date(2026, 3, 15, 9, 0, 0, 0); // Wed 9am exactly
    const res = nextDeliveryForZone(zone, now)!;
    expect(res.deliveryDate.getDate()).toBe(23); // next Thu, not Apr 16
  });

  it("respects zero-hour cutoff (ships up to delivery time)", () => {
    const zone: Zone = { delivery_days: ["Thursday"], cutoff_hours_before_delivery: 0 };
    const now = new Date(2026, 3, 16, 8, 0, 0); // Thu 8am, 1hr before delivery
    const res = nextDeliveryForZone(zone, now)!;
    expect(res.deliveryDate.getDate()).toBe(16);
    expect(res.cutoffAt.getTime()).toBe(res.deliveryDate.getTime());
  });

  it("returns null when every delivery day in the 14-day window is past cutoff", () => {
    // cutoff is > 14 days before delivery, so nothing within the 14-day loop window
    // can have cutoff in the future.
    const zone: Zone = { delivery_days: ["Monday"], cutoff_hours_before_delivery: 24 * 30 };
    const now = new Date(2026, 3, 13, 8, 0, 0);
    expect(nextDeliveryForZone(zone, now)).toBeNull();
  });

  it("reports msUntilCutoff consistent with cutoffAt - now", () => {
    const zone: Zone = { delivery_days: ["Thursday"], cutoff_hours_before_delivery: 12 };
    const now = new Date(2026, 3, 13, 10, 0, 0);
    const res = nextDeliveryForZone(zone, now)!;
    expect(res.msUntilCutoff).toBe(res.cutoffAt.getTime() - now.getTime());
  });
});
