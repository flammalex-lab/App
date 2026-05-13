import type { Category, Product } from "@/lib/supabase/types";

/**
 * Heuristic sub-category labels used to group products within a category
 * on the buyer-facing catalog (Dairy → Milk / Yogurt & kefir / Butter &
 * cream / Eggs rows instead of the older Producer-per-row layout).
 *
 * Vocabulary is intentionally consolidated — never under 3 items live for
 * a healthy bucket. Buyer language wins over taxonomic purity ("Butter &
 * cream" reads naturally even though they're different fat profiles;
 * "Pork & cured" because Ham + Bacon belong in the same butcher-case
 * section). See the v3 CSV transform for the canonical bucket list.
 *
 * `products.sub_category` (admin-set via the name-review CSV) always
 * wins over this regex pass — see subCategoryOf below.
 *
 * Order matters per category — the first matching regex wins, so put
 * more specific patterns first (e.g. "Skyr" before "Yogurt").
 */
type Pattern = { match: RegExp; label: string };

/**
 * Meat SKU prefix → sub-category. Used when the product name no longer
 * carries the species word (e.g. "Shoulder Boneless" for an Oink & Gobble
 * pork shoulder — renamed during the catalog cleanup) because the runtime
 * regex can't tell beef from pork from the name alone.
 */
const MEAT_SKU_PREFIX: Array<[RegExp, string]> = [
  [/^(BF|RK)-/i, "Beef"],
  [/^PK-/i, "Pork & cured"],
  [/^LB-/i, "Lamb"],
];

const PATTERNS: Record<Category, Pattern[]> = {
  meat: [
    { match: /\b(sausages?|brat|wurst|kielbasa|frank|hot ?dogs?)\b/i, label: "Sausage" },
    { match: /\b(turkey|duck|chicken|poultry|hen|rabbit|quail)\b/i, label: "Poultry & game" },
    { match: /\b(lamb|mutton|sheep)\b/i, label: "Lamb" },
    // Pork & cured — ham, bacon, prosciutto, etc. fold in here.
    { match: /\b(pork|bacon|hams?|prosciutto|chorizo|pancetta|deley)\b/i, label: "Pork & cured" },
    {
      match: /\b(beef|steak|burger|brisket|tenderloin|ribeye|chuck|sirloin|patties?|patty|hanging|carcass|short ?rib|namp|loin|round|ranch|trex|flap|tri ?tip|flat iron|skirt|hanger|liver|tongue|heart|oxtail|osso|bones?|cube|stew|kabob|flank)\b/i,
      label: "Beef",
    },
  ],
  dairy: [
    { match: /\beggs?\b|duck eggs/i, label: "Eggs" },
    // Butter and cream live together — buyers shop them as a unit.
    { match: /\b(butter|buttermilk)\b/i, label: "Butter & cream" },
    { match: /\b(heavy\s+cream|cream|half\s*(?:and|&)?\s*half)\b/i, label: "Butter & cream" },
    // Kefir folds into yogurt (cultured-dairy drinks shop together).
    { match: /\b(skyr|yogurts?|yoghurt|yogourt|kefir)\b/i, label: "Yogurt & kefir" },
    { match: /\bmilk\b/i, label: "Milk" },
  ],
  cheese: [
    { match: /\b(cr[èe]me cheese|cream cheese)\b/i, label: "Fresh & soft" },
    { match: /\bfeta\b/i, label: "Fresh & soft" },
    { match: /\bblue\b/i, label: "Blue" },
    { match: /\b(ch[èe]vre|chamomilla|gitane|sheldrake|fromage blanc|burrata|mozzarella|tom\b)/i, label: "Fresh & soft" },
    { match: /\b(gruy[èe]re|raclette|alpine|finger lakes gold|emmental|comt[èe])\b/i, label: "Alpine" },
    { match: /\b(parm|parmesan|gouda|aged|reserve|hard)\b/i, label: "Aged & hard" },
    { match: /\bcheddar\b/i, label: "Cheddar" },
  ],
  produce: [
    { match: /\b(salad kit|caesar)\b/i, label: "Greens" },
    { match: /\b(dressing|vinaigrette|dip|pesto|queso|tzatziki)\b/i, label: "Dressings & dips" },
    { match: /\b(lettuces?|romaine|spring mix|spinach|mesclun|butterhead|leaf|salad|big green|arugula|kale|chard|mix|greens?)\b/i, label: "Greens" },
    { match: /\b(beets?|carrots?|kohlrabi|radish(?:es)?|potatoes?|fingerlings?|root veg|onions?|turnips?|parsnips?|rutabagas?|sunchokes?)\b/i, label: "Roots" },
    { match: /\bapples?\b/i, label: "Apples" },
    // Vegetables & herbs — celery, basil, fennel, brassicas, peppers, etc.
    { match: /\b(celery|basil|herbs?|fennel|broccoli|cauliflower|cabbage|brussels|tomatoes?|peppers?|squash|zucchini|cucumber|mushrooms?|crunch)\b/i, label: "Vegetables & herbs" },
  ],
  pantry: [
    { match: /\b(pierogi(?:es)?|ravioli|pasta|gnocchi|tortellini|dumpling)\b/i, label: "Pasta & prepared" },
    { match: /\b(pickles?|kraut|kim ?chee|kimchi|ferment(?:ed)?|sauerkraut|ginger carrots|ginger beets|turmeric)\b/i, label: "Ferments" },
    { match: /\b(maple syrup|honey|syrup|sugar|sweetener)\b/i, label: "Sweeteners" },
    { match: /\bsalt\b|\bspice\b/i, label: "Salt & spices" },
    { match: /\b(salumi|salami|charcuterie|sausages?|pepperoni|pate|paté|mortadella|capicola)\b/i, label: "Charcuterie" },
    { match: /\b(pita|pocket bread|tortillas?|breads?|chips?|crackers?|cookies?|biscuits?|granola|cereal)\b/i, label: "Bakery & snacks" },
    { match: /\b(flour|corn\s*meal|polenta|berries|berry|wheat|spelt|rye|einkorn|farro|grain|oats?)\b/i, label: "Grains & flour" },
    { match: /\b(lentils?|chickpeas?|beans?|popcorn|peas?)\b/i, label: "Legumes" },
    { match: /\b(mustards?|horseradish|aioli|ketchup|relish|hot sauce)\b/i, label: "Condiments" },
    { match: /\b(jam|apple butter|apple sauce|spread|preserve|jelly)\b/i, label: "Spreads" },
  ],
  beverages: [
    // Functional / wellness before soda — "Superfood Drink" isn't a soda.
    { match: /\b(cbd|delta 9|thd|superfood|shot|elixir|coconut water|kombucha)\b/i, label: "Functional" },
    { match: /\b(sparkling water|seltzer|mineral water|water)\b/i, label: "Water & sparkling" },
    { match: /\b(barista|oat milk|almond|oatly|califia|minor figures|plant milk)\b/i, label: "Plant milk" },
    { match: /\b(coffee|espresso|teas?)\b/i, label: "Tea & kombucha" },
    { match: /\bcider\b/i, label: "Cider" },
    { match: /\b(lemonade|orange|apricot|grapefruit|tangerine|stomp|carrot ginger|kale|pineapple|guava|strawberry|blood orange|lemon juice|lime juice|apple blends|juice|nectar)\b/i, label: "Juice" },
    { match: /\b(soda|cola|ginger ale|root beer|birch beer|shirley temple|fizz|tonic)\b/i, label: "Soda" },
  ],
};

const FALLBACK: Record<Category, string> = {
  meat: "Beef",
  dairy: "Milk",
  cheese: "Specialty",
  produce: "Vegetables & herbs",
  pantry: "Other",
  beverages: "Juice",
};

export function subCategoryOf(
  name: string,
  category: Category,
  manualOverride?: string | null,
  sku?: string | null,
): string {
  // Admin-set value via the name-review CSV wins. Falls through to the
  // regex when the column is null/empty so unset products still bucket.
  const manual = manualOverride?.trim();
  if (manual) return manual;

  // Meat needs SKU-prefix awareness — see MEAT_SKU_PREFIX comment.
  if (category === "meat") {
    const patterns = PATTERNS.meat;
    // Run name patterns first, but skip Beef (the catch-all) so it
    // doesn't shadow a pork/lamb SKU.
    for (const p of patterns) {
      if (p.label === "Beef") continue;
      if (p.match.test(name)) return p.label;
    }
    if (sku) {
      for (const [rx, label] of MEAT_SKU_PREFIX) {
        if (rx.test(sku)) return label;
      }
    }
    return FALLBACK.meat;
  }

  const patterns = PATTERNS[category];
  for (const p of patterns) {
    if (p.match.test(name)) return p.label;
  }
  return FALLBACK[category];
}

/**
 * Group a priced-products list by buyer-facing sub-category. Each item's
 * own `category` column drives which pattern set runs against its name —
 * matters for the "grocery" buyer-facing group, which spans both pantry
 * and beverages categories (pantry items get "Ferments" / "Grains" etc.,
 * beverages items get "Juice" / "Cider" etc.). Preserves the
 * first-appearance order of sub-categories so the parent query's sort
 * still drives which strip leads the page.
 */
export function groupBySubCategory<
  T extends Pick<Product, "name" | "category"> & {
    sub_category?: string | null;
    sku?: string | null;
  },
>(items: T[]): { subCategory: string; items: T[] }[] {
  const order: string[] = [];
  const bucket = new Map<string, T[]>();
  for (const p of items) {
    const key = subCategoryOf(p.name, p.category, p.sub_category, p.sku);
    if (!bucket.has(key)) {
      bucket.set(key, []);
      order.push(key);
    }
    bucket.get(key)!.push(p);
  }
  return order.map((k) => ({ subCategory: k, items: bucket.get(k)! }));
}
