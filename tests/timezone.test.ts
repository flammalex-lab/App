import { dateAtZoneTime, partsInTz } from "@/lib/utils/timezone";
import { nextDeliveryForZone } from "@/lib/utils/cutoff";
import { computeNextRun } from "@/lib/utils/standing-order";
import type { DeliveryZoneRow, StandingOrder } from "@/lib/supabase/types";

const NY = "America/New_York";

describe("dateAtZoneTime", () => {
  it("materializes a wall-clock time in ET — summer (EDT, UTC-4)", () => {
    // July 4, 2026 9am ET = July 4, 2026 13:00 UTC
    const d = dateAtZoneTime(2026, 7, 4, 9, 0, NY);
    expect(d.toISOString()).toBe("2026-07-04T13:00:00.000Z");
  });

  it("materializes a wall-clock time in ET — winter (EST, UTC-5)", () => {
    // Jan 15, 2026 9am ET = Jan 15, 2026 14:00 UTC
    const d = dateAtZoneTime(2026, 1, 15, 9, 0, NY);
    expect(d.toISOString()).toBe("2026-01-15T14:00:00.000Z");
  });

  it("partsInTz reads weekday correctly across tz", () => {
    // Friday Jul 3, 2026 23:00 UTC = Friday Jul 3, 2026 19:00 ET
    const d = new Date("2026-07-03T23:00:00.000Z");
    const p = partsInTz(d, NY);
    expect(p.year).toBe(2026);
    expect(p.month).toBe(7);
    expect(p.day).toBe(3);
    expect(p.weekday).toBe(5); // Friday
    expect(p.hour).toBe(19);
  });

  it("partsInTz crosses midnight correctly", () => {
    // Sun Jan 4, 2026 03:00 UTC = Sat Jan 3, 2026 22:00 ET
    const d = new Date("2026-01-04T03:00:00.000Z");
    const p = partsInTz(d, NY);
    expect(p.weekday).toBe(6); // Saturday
    expect(p.day).toBe(3);
    expect(p.hour).toBe(22);
  });
});

describe("nextDeliveryForZone (tz-aware)", () => {
  type Zone = Pick<DeliveryZoneRow, "delivery_days" | "cutoff_hours_before_delivery">;

  it("computes a Thursday delivery for a Monday morning request, in ET", () => {
    const zone: Zone = { delivery_days: ["Thursday"], cutoff_hours_before_delivery: 24 };
    // Mon Jul 13, 2026 — 13:00 UTC = 9am ET
    const now = new Date("2026-07-13T13:00:00.000Z");
    const res = nextDeliveryForZone(zone, now, NY)!;
    expect(res).not.toBeNull();
    // Delivery should be Thu Jul 16, 2026 at 9am ET = 13:00 UTC
    expect(res.deliveryDate.toISOString()).toBe("2026-07-16T13:00:00.000Z");
    expect(res.deliveryDayName).toBe("Thursday");
    expect(res.pastCutoff).toBe(false);
  });

  it("flags pastCutoff=true when the soonest window was missed", () => {
    const zone: Zone = { delivery_days: ["Thursday"], cutoff_hours_before_delivery: 24 };
    // Wed Jul 15 21:00 UTC = Wed Jul 15 17:00 ET — Thu 9am cutoff was Wed 9am ET (5 UTC), already past.
    const now = new Date("2026-07-15T21:00:00.000Z");
    const res = nextDeliveryForZone(zone, now, NY)!;
    expect(res.pastCutoff).toBe(true);
    // Rolled to next Thursday Jul 23, 2026
    expect(res.deliveryDate.toISOString()).toBe("2026-07-23T13:00:00.000Z");
  });
});

describe("computeNextRun (tz-aware)", () => {
  const so = (over: Partial<StandingOrder> = {}) => ({
    days_of_week: ["Monday"],
    frequency: "weekly" as const,
    last_run_date: null,
    pause_until: null,
    active: true,
    ...over,
  });

  it("returns Monday 6am ET when called early on Monday in ET", () => {
    // Mon Jul 13, 2026 09:00 UTC = 5am ET — 6am ET window still ahead.
    const now = new Date("2026-07-13T09:00:00.000Z");
    const next = computeNextRun(so(), now, NY)!;
    // Monday 6am ET = 10:00 UTC (EDT)
    expect(next.toISOString()).toBe("2026-07-13T10:00:00.000Z");
  });

  it("rolls to next Monday when today's 6am ET has passed", () => {
    // Mon Jul 13, 2026 14:00 UTC = 10am ET — today's 6am gone.
    const now = new Date("2026-07-13T14:00:00.000Z");
    const next = computeNextRun(so(), now, NY)!;
    // Next Mon = Jul 20 6am ET = 10:00 UTC
    expect(next.toISOString()).toBe("2026-07-20T10:00:00.000Z");
  });
});
