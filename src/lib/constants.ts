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
