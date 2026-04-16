import type { Brand, Category, DeliveryZone } from "@/lib/supabase/types";

export const BRAND_LABELS: Record<Brand, string> = {
  grasslands: "Grasslands",
  meadow_creek: "Meadow Creek",
  fingerlakes_farms: "Fingerlakes Farms",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  beef: "Beef",
  pork: "Pork",
  lamb: "Lamb",
  eggs: "Eggs",
  dairy: "Dairy",
  produce: "Produce",
  pantry: "Pantry",
  beverages: "Beverages",
};

// ---- Buyer-facing product groups ----
export type ProductGroup = "meat" | "grocery" | "produce" | "dairy" | "cheese";

export const GROUP_LABELS: Record<ProductGroup, string> = {
  meat: "Meat",
  grocery: "Grocery",
  produce: "Produce",
  dairy: "Dairy",
  cheese: "Cheese",
};

export const ALL_GROUPS: ProductGroup[] = ["meat", "grocery", "produce", "dairy", "cheese"];

// ---- Buyer types (drives which groups a buyer sees on the catalog) ----
export type BuyerType =
  | "gm_restaurant"
  | "gm_retail"
  | "meat_buyer"
  | "produce_buyer"
  | "dairy_buyer"
  | "cheese_buyer"
  | "grocery_buyer";

export const BUYER_TYPE_LABELS: Record<BuyerType, string> = {
  gm_restaurant: "General Manager — Restaurant",
  gm_retail: "General Manager — Retail",
  meat_buyer: "Meat Buyer",
  produce_buyer: "Produce Buyer",
  dairy_buyer: "Dairy Buyer",
  cheese_buyer: "Cheese Buyer",
  grocery_buyer: "Grocery Buyer",
};

export function allowedGroupsFor(buyerType: string | null | undefined): ProductGroup[] {
  switch (buyerType) {
    case "gm_retail":
    case "gm_restaurant":
      return [...ALL_GROUPS];
    case "meat_buyer":
      return ["meat"];
    case "produce_buyer":
      return ["produce"];
    case "dairy_buyer":
      return ["dairy"];
    case "cheese_buyer":
      return ["cheese"];
    case "grocery_buyer":
      return ["grocery"];
    default:
      return [...ALL_GROUPS]; // default: see everything
  }
}

export const ZONE_LABELS: Record<DeliveryZone, string> = {
  finger_lakes: "Finger Lakes",
  nyc_metro: "NYC Metro",
  hudson_valley: "Hudson Valley",
  long_island: "Long Island",
  nj_pa_ct: "NJ / PA / CT",
  buffalo: "Buffalo",
  rochester: "Rochester",
  syracuse: "Syracuse",
  ithaca: "Ithaca",
};

export const TIER_MULTIPLIERS = {
  standard: 1.0,
  volume: 0.92,
  custom: 1.0, // custom requires account_pricing override; multiplier ignored
} as const;

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export type DayName = (typeof DAY_NAMES)[number];

// Short day-of-week key used in order_guide_items.par_levels JSON
export const DAY_SHORT: Record<DayName, string> = {
  Sunday: "sun",
  Monday: "mon",
  Tuesday: "tue",
  Wednesday: "wed",
  Thursday: "thu",
  Friday: "fri",
  Saturday: "sat",
};
