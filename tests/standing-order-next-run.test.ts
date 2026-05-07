import { computeNextRun } from "@/lib/utils/standing-order";
import type { StandingOrder } from "@/lib/supabase/types";

// April 2026: 13=Mon, 14=Tue, 15=Wed, 16=Thu, 17=Fri, 18=Sat, 19=Sun

type SO = Pick<StandingOrder, "days_of_week" | "frequency" | "last_run_date" | "pause_until" | "active">;

const so = (over: Partial<SO> = {}): SO => ({
  days_of_week: ["Monday"],
  frequency: "weekly",
  last_run_date: null,
  pause_until: null,
  active: true,
  ...over,
});

describe("computeNextRun", () => {
  it("returns null when standing order is inactive", () => {
    const now = new Date(2026, 3, 13, 3, 0, 0); // Mon 3am
    expect(computeNextRun(so({ active: false }), now)).toBeNull();
  });

  it("returns null when paused until a future date", () => {
    const now = new Date(2026, 3, 13, 3, 0, 0);
    expect(
      computeNextRun(so({ pause_until: new Date(2026, 3, 20).toISOString() }), now),
    ).toBeNull();
  });

  it("resumes after pause_until has passed", () => {
    const now = new Date(2026, 3, 14, 3, 0, 0); // Tue 3am
    const next = computeNextRun(
      so({
        days_of_week: ["Thursday"],
        pause_until: new Date(2026, 3, 13, 23, 0, 0).toISOString(),
      }),
      now,
    )!;
    expect(next).not.toBeNull();
    expect(next.getDay()).toBe(4); // Thursday
  });

  it("returns null when no valid days_of_week", () => {
    const now = new Date(2026, 3, 13, 3, 0, 0);
    expect(computeNextRun(so({ days_of_week: [] }), now)).toBeNull();
    expect(computeNextRun(so({ days_of_week: ["Funday"] }), now)).toBeNull();
  });

  it("picks today before 6am run-time for a weekly schedule", () => {
    // Monday 3am — the 6am run window for today is still ahead.
    const now = new Date(2026, 3, 13, 3, 0, 0);
    const next = computeNextRun(so({ days_of_week: ["Monday"] }), now)!;
    expect(next.getDate()).toBe(13);
    expect(next.getHours()).toBe(6);
  });

  it("rolls to next week when today's 6am run has already passed", () => {
    // Monday 10am — today's 6am window is gone.
    const now = new Date(2026, 3, 13, 10, 0, 0);
    const next = computeNextRun(so({ days_of_week: ["Monday"] }), now)!;
    expect(next.getDate()).toBe(20); // next Monday
    expect(next.getDay()).toBe(1);
  });

  it("picks the soonest of multiple configured days", () => {
    const now = new Date(2026, 3, 13, 10, 0, 0); // Mon 10am
    const next = computeNextRun(
      so({ days_of_week: ["Monday", "Thursday"] }),
      now,
    )!;
    expect(next.getDay()).toBe(4); // Thursday (Apr 16)
    expect(next.getDate()).toBe(16);
  });

  describe("biweekly", () => {
    it("runs on next matching day when no last_run_date", () => {
      const now = new Date(2026, 3, 13, 3, 0, 0); // Mon 3am
      const next = computeNextRun(
        so({ frequency: "biweekly", days_of_week: ["Monday"] }),
        now,
      )!;
      expect(next.getDate()).toBe(13);
    });

    it("skips the candidate if fewer than 14 days since last run", () => {
      // last run Apr 6 (Mon). now = Apr 13 Mon 3am. Apr 13 is only 7 days after — skip.
      const now = new Date(2026, 3, 13, 3, 0, 0);
      const next = computeNextRun(
        so({
          frequency: "biweekly",
          days_of_week: ["Monday"],
          last_run_date: "2026-04-06",
        }),
        now,
      )!;
      expect(next.getDate()).toBe(20); // Apr 20 — 14 days after Apr 6
    });

    it("allows the candidate when ≥14 days since last run", () => {
      const now = new Date(2026, 3, 13, 3, 0, 0);
      const next = computeNextRun(
        so({
          frequency: "biweekly",
          days_of_week: ["Monday"],
          last_run_date: "2026-03-30", // 14 days back
        }),
        now,
      )!;
      expect(next.getDate()).toBe(13);
    });
  });
});
