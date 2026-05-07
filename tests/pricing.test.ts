import { resolvePrice } from "@/lib/utils/pricing";
import type { Account, AccountPricing, Product } from "@/lib/supabase/types";

const product = (over: Partial<Product> = {}): Pick<Product, "wholesale_price" | "retail_price"> => ({
  wholesale_price: 10,
  retail_price: 15,
  ...over,
});

const account = (tier: Account["pricing_tier"] = "standard"): Pick<Account, "pricing_tier"> => ({
  pricing_tier: tier,
});

const override = (
  price: number,
  effective: string,
  expiry: string | null = null,
): Pick<AccountPricing, "custom_price" | "effective_date" | "expiry_date"> => ({
  custom_price: price,
  effective_date: effective,
  expiry_date: expiry,
});

describe("resolvePrice", () => {
  const NOW = new Date("2026-04-17T12:00:00Z");

  describe("account override", () => {
    it("wins when effective and not expired", () => {
      const price = resolvePrice(product(), {
        account: account("standard"),
        customPrice: override(7.5, "2026-01-01", "2026-12-31"),
        isB2B: true,
        now: NOW,
      });
      expect(price).toBe(7.5);
    });

    it("is ignored when not yet effective", () => {
      const price = resolvePrice(product(), {
        account: account("standard"),
        customPrice: override(7.5, "2026-05-01"),
        isB2B: true,
        now: NOW,
      });
      expect(price).toBe(10); // falls back to wholesale
    });

    it("is ignored when expired", () => {
      const price = resolvePrice(product(), {
        account: account("standard"),
        customPrice: override(7.5, "2026-01-01", "2026-03-01"),
        isB2B: true,
        now: NOW,
      });
      expect(price).toBe(10);
    });

    it("accepts null expiry as open-ended", () => {
      const price = resolvePrice(product(), {
        account: account("standard"),
        customPrice: override(7.5, "2026-01-01", null),
        isB2B: true,
        now: NOW,
      });
      expect(price).toBe(7.5);
    });

    it("applies on the exact effective_date boundary", () => {
      const price = resolvePrice(product(), {
        account: account("standard"),
        customPrice: override(7.5, "2026-04-17"),
        isB2B: true,
        now: new Date("2026-04-17T12:00:00Z"),
      });
      expect(price).toBe(7.5);
    });

    it("overrides apply to DTC too (override wins over isB2B)", () => {
      const price = resolvePrice(product(), {
        customPrice: override(4.99, "2026-01-01"),
        isB2B: false,
        now: NOW,
      });
      expect(price).toBe(4.99);
    });
  });

  describe("B2B wholesale tier", () => {
    it("standard tier is 1.0×", () => {
      expect(
        resolvePrice(product({ wholesale_price: 12 }), {
          account: account("standard"),
          isB2B: true,
          now: NOW,
        }),
      ).toBe(12);
    });

    it("volume tier is 0.92×", () => {
      expect(
        resolvePrice(product({ wholesale_price: 10 }), {
          account: account("volume"),
          isB2B: true,
          now: NOW,
        }),
      ).toBe(9.2);
    });

    it("rounds to 2 decimals", () => {
      // 13.37 * 0.92 = 12.3004 -> 12.30
      expect(
        resolvePrice(product({ wholesale_price: 13.37 }), {
          account: account("volume"),
          isB2B: true,
          now: NOW,
        }),
      ).toBe(12.30);
    });

    it("defaults to 'standard' when account is null", () => {
      expect(
        resolvePrice(product({ wholesale_price: 10 }), {
          account: null,
          isB2B: true,
          now: NOW,
        }),
      ).toBe(10);
    });

    it("returns null when wholesale_price is missing", () => {
      expect(
        resolvePrice(product({ wholesale_price: null as unknown as number }), {
          account: account("standard"),
          isB2B: true,
          now: NOW,
        }),
      ).toBeNull();
    });
  });

  describe("DTC retail", () => {
    it("uses retail_price when isB2B is false", () => {
      expect(
        resolvePrice(product({ retail_price: 19.99 }), {
          isB2B: false,
          now: NOW,
        }),
      ).toBe(19.99);
    });

    it("returns null when retail_price is missing", () => {
      expect(
        resolvePrice(product({ retail_price: null as unknown as number }), {
          isB2B: false,
          now: NOW,
        }),
      ).toBeNull();
    });
  });

  describe("priority", () => {
    it("override beats wholesale tier even when tier would be cheaper", () => {
      // volume tier: 10 * 0.92 = 9.20; override: 11
      const price = resolvePrice(product({ wholesale_price: 10 }), {
        account: account("volume"),
        customPrice: override(11, "2026-01-01"),
        isB2B: true,
        now: NOW,
      });
      expect(price).toBe(11);
    });

    it("uses current time by default when now is not provided", () => {
      const farFuture = override(7.5, "2099-01-01");
      const price = resolvePrice(product(), {
        account: account("standard"),
        customPrice: farFuture,
        isB2B: true,
      });
      expect(price).toBe(10); // override not yet effective
    });
  });
});
