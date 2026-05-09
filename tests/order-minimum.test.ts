import {
  meetsMinimum,
  shortfall,
  effectiveOrderMinimum,
} from "@/lib/utils/order-minimum";

describe("meetsMinimum", () => {
  it("returns true when minimum is 0 or negative", () => {
    expect(meetsMinimum({ subtotal: 0, deliveryFee: 0, minimum: 0 })).toBe(true);
    expect(meetsMinimum({ subtotal: 0, deliveryFee: 0, minimum: -5 })).toBe(true);
  });

  it("compares subtotal + deliveryFee against minimum", () => {
    expect(meetsMinimum({ subtotal: 100, deliveryFee: 10, minimum: 50 })).toBe(true);
    expect(meetsMinimum({ subtotal: 100, deliveryFee: 10, minimum: 110 })).toBe(true);
    expect(meetsMinimum({ subtotal: 100, deliveryFee: 10, minimum: 111 })).toBe(false);
  });

  it("treats subtotal alone correctly when delivery is 0", () => {
    expect(meetsMinimum({ subtotal: 50, deliveryFee: 0, minimum: 50 })).toBe(true);
    expect(meetsMinimum({ subtotal: 49, deliveryFee: 0, minimum: 50 })).toBe(false);
  });

  it("counts delivery fee toward the minimum", () => {
    // The audit's M8 fix is specifically that delivery fee counts toward min.
    expect(meetsMinimum({ subtotal: 45, deliveryFee: 5, minimum: 50 })).toBe(true);
  });
});

describe("shortfall", () => {
  it("returns 0 when minimum is met", () => {
    expect(shortfall({ subtotal: 100, deliveryFee: 0, minimum: 50 })).toBe(0);
    expect(shortfall({ subtotal: 50, deliveryFee: 0, minimum: 50 })).toBe(0);
  });

  it("returns 0 when minimum is 0 or negative", () => {
    expect(shortfall({ subtotal: 0, deliveryFee: 0, minimum: 0 })).toBe(0);
    expect(shortfall({ subtotal: 10, deliveryFee: 0, minimum: -5 })).toBe(0);
  });

  it("returns the difference when below minimum", () => {
    expect(shortfall({ subtotal: 30, deliveryFee: 5, minimum: 50 })).toBe(15);
    expect(shortfall({ subtotal: 0, deliveryFee: 0, minimum: 100 })).toBe(100);
  });
});

describe("effectiveOrderMinimum", () => {
  it("returns 0 when account is null (DTC, no account context)", () => {
    expect(effectiveOrderMinimum(null, null)).toBe(0);
    expect(effectiveOrderMinimum(null, { order_minimum: 50 })).toBe(0);
  });

  it("uses account.order_minimum when set", () => {
    expect(
      effectiveOrderMinimum({ order_minimum: 100 }, { order_minimum: 50 }),
    ).toBe(100);
  });

  it("falls back to zone.order_minimum when account.order_minimum is null", () => {
    expect(
      effectiveOrderMinimum({ order_minimum: null }, { order_minimum: 50 }),
    ).toBe(50);
  });

  it("falls back to 0 when both are null", () => {
    expect(effectiveOrderMinimum({ order_minimum: null }, null)).toBe(0);
    expect(
      effectiveOrderMinimum({ order_minimum: null }, { order_minimum: null }),
    ).toBe(0);
  });

  it("treats account.order_minimum=0 as an explicit override (not falsy fallback)", () => {
    // An account explicitly set to 0 should NOT fall back to a non-zero zone min.
    expect(
      effectiveOrderMinimum({ order_minimum: 0 }, { order_minimum: 50 }),
    ).toBe(0);
  });
});
