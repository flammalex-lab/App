import { isDeliveryDateStale } from "@/lib/utils/delivery-date";

describe("isDeliveryDateStale (audit Bug A — false-negative submit gate)", () => {
  it("returns false when the chosen date is the earliest available", () => {
    expect(isDeliveryDateStale("2026-05-19", "2026-05-19")).toBe(false);
  });

  it("returns false when the chosen date is AFTER the earliest available", () => {
    // Repro: buyer picked Tue Jun 9 via /cart's 12-date picker. The
    // SubmitSheet on /guide only carries 4 dates, so Jun 9 isn't in
    // its upcoming list. Pre-fix, a membership check returned "stale"
    // and the submit button read "Pick a valid delivery date" even
    // though the date is perfectly orderable.
    expect(isDeliveryDateStale("2026-06-09", "2026-05-19")).toBe(false);
  });

  it("returns true when the chosen date is BEFORE the earliest available", () => {
    // The actual stale case: buyer left the tab open, cutoff rolled,
    // their stored date is now older than what's still orderable.
    expect(isDeliveryDateStale("2026-05-15", "2026-05-19")).toBe(true);
  });

  it("returns false when chosenDate is null or empty", () => {
    expect(isDeliveryDateStale(null, "2026-05-19")).toBe(false);
    expect(isDeliveryDateStale("", "2026-05-19")).toBe(false);
  });

  it("returns false when earliestUpcomingDate is null (no schedule)", () => {
    expect(isDeliveryDateStale("2026-05-19", null)).toBe(false);
    expect(isDeliveryDateStale("2026-05-19", undefined)).toBe(false);
  });

  it("accepts a full ISO timestamp on either side and compares calendar dates", () => {
    // The cart store sometimes carries a time-suffixed ISO; the helper
    // normalises both sides to YYYY-MM-DD before comparison so a same-
    // day pick at 1pm doesn't read as "before" a 9am earliest.
    expect(
      isDeliveryDateStale("2026-05-19T13:00:00Z", "2026-05-19T09:00:00Z"),
    ).toBe(false);
    expect(
      isDeliveryDateStale("2026-05-15T23:59:00Z", "2026-05-19"),
    ).toBe(true);
  });

  it("handles malformed strings safely (does not throw, treats as not-stale)", () => {
    expect(isDeliveryDateStale("not-a-date", "2026-05-19")).toBe(false);
    expect(isDeliveryDateStale("2026-05-19", "garbage")).toBe(false);
  });
});
