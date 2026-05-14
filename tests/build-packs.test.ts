import { buildSelfPacks, isGroupedCandidate } from "@/lib/products/build-packs";
import type { PricingContext } from "@/lib/utils/pricing";
import type { PackOption, Product } from "@/lib/supabase/types";

function product(over: Partial<Product> = {}): Product {
  return {
    id: "prod-1",
    name: "Whole Milk",
    sku: "MILK-1",
    unit: "case",
    pack_size: "6 / 1 gal",
    case_pack: null,
    wholesale_price: 12,
    retail_price: 18,
    available_b2b: true,
    available_dtc: true,
    available_this_week: true,
    is_active: true,
    pack_options: null,
    price_by_weight: false,
    producer: "Ithaca Milk",
    category: "dairy",
    additional_groups: [],
    avg_weight_lbs: null,
    brand: "fingerlakes_farms",
    description: null,
    image_url: null,
    private: false,
    product_group: "dairy",
    sort_order: 1,
    sub_category: null,
    ...over,
  } as unknown as Product;
}

function ctx(over: Partial<PricingContext> = {}): PricingContext {
  return {
    account: null,
    isB2B: true,
    overrides: [],
    listItems: [],
    ...over,
  };
}

describe("buildSelfPacks", () => {
  it("returns a single row for a product with no pack_options", () => {
    const packs = buildSelfPacks(product(), ctx());
    expect(packs).toHaveLength(1);
    expect(packs[0].productId).toBe("prod-1");
    expect(packs[0].variantKey).toBeNull();
    expect(packs[0].unitPrice).toBe(12); // wholesale × standard tier (1.0)
  });

  it("prices each pack_option in addition to the default", () => {
    const opts: PackOption[] = [
      {
        key: "single",
        label: "Single",
        unit: "gallon",
        pack_size: "1 gal",
        sku: "MILK-1-SGL",
        wholesale_price: 3,
        retail_price: 5,
      } as PackOption,
    ];
    const packs = buildSelfPacks(product({ pack_options: opts as any }), ctx());
    expect(packs).toHaveLength(2);
    expect(packs[1].variantKey).toBe("single");
    expect(packs[1].unitPrice).toBe(3);
  });

  it("skips unpriced packs", () => {
    const opts: PackOption[] = [
      {
        key: "broken",
        label: "Broken",
        unit: "gallon",
        pack_size: "1 gal",
        sku: null,
        wholesale_price: null,
        retail_price: null,
      } as PackOption,
    ];
    const packs = buildSelfPacks(product({ pack_options: opts as any }), ctx());
    expect(packs).toHaveLength(1);
    expect(packs[0].variantKey).toBeNull();
  });

  it("returns empty when the product has no usable price at all", () => {
    const packs = buildSelfPacks(
      product({ wholesale_price: null, retail_price: null }),
      ctx(),
    );
    expect(packs).toEqual([]);
  });
});

describe("isGroupedCandidate", () => {
  it("recognises em-dash suffixed names", () => {
    expect(isGroupedCandidate("Whole Milk — Gallon")).toBe(true);
  });
  it("recognises en-dash suffixed names", () => {
    expect(isGroupedCandidate("Yogurt – Quart")).toBe(true);
  });
  it("recognises middot suffixed names", () => {
    expect(isGroupedCandidate("Cheddar · 6 oz")).toBe(true);
  });
  it("returns false for plain hyphens (compound words)", () => {
    expect(isGroupedCandidate("X-Large Brown Eggs")).toBe(false);
  });
  it("returns false for names with no suffix", () => {
    expect(isGroupedCandidate("Whole Milk")).toBe(false);
  });
});
