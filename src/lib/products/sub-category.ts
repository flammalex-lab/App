import type { Category, Product } from "@/lib/supabase/types";

/**
 * Heuristic sub-category labels used to group products within a category
 * on the buyer-facing catalog (Dairy → Milk / Eggs / Yogurt / Butter
 * rows instead of the older Producer-per-row layout).
 *
 * TODO: replace with a real `products.sub_category` column once the
 * admin form has a picker for it. Until then, this regex pass is good
 * enough for the catalog scroll-strips because the FLF name conventions
 * already lead with the category word (Brown Eggs, Whole Milk, Greek
 * Yogurt, etc.). A few products fall through to "Other" — that's
 * acceptable; admin can rename them via the product form to land in the
 * right bucket.
 *
 * Order matters per category — the first matching regex wins, so put
 * more specific patterns first (e.g. "Skyr" before "Yogurt").
 */
type Pattern = { match: RegExp; label: string };

const PATTERNS: Record<Category, Pattern[]> = {
  meat: [
    { match: /\bduck\b/i, label: "Duck" },
    { match: /\b(chicken|poultry|hen)\b/i, label: "Chicken" },
    { match: /\b(lamb|mutton)\b/i, label: "Lamb" },
    { match: /\b(pork|bacon|ham|prosciutto|chorizo|pancetta)\b/i, label: "Pork" },
    { match: /\b(sausage|brat|wurst|kielbasa|frank|hotdog|hot dog)\b/i, label: "Sausage" },
    {
      match: /\b(salami|charcuterie|pepperoni|pate|paté|mortadella|capicola)\b/i,
      label: "Charcuterie",
    },
    {
      match: /\b(beef|steak|burger|brisket|tenderloin|ribeye|chuck|sirloin|patties?|patty|hanging|carcass|short ?rib)\b/i,
      label: "Beef",
    },
  ],
  dairy: [
    { match: /\b(egg|eggs)\b/i, label: "Eggs" },
    { match: /\bkefir\b/i, label: "Kefir" },
    { match: /\b(skyr|yogurt|yoghurt|yogourt)\b/i, label: "Yogurt" },
    { match: /\bbutter\b/i, label: "Butter" },
    { match: /\b(cream|crème|creme|half[- ]and[- ]half)\b/i, label: "Cream" },
    { match: /\bmilk\b/i, label: "Milk" },
  ],
  cheese: [
    // Cheese is already its own top-level category; keep one bucket so
    // the picker still produces a strip rather than collapsing to a
    // flat grid.
    { match: /.*/i, label: "Cheese" },
  ],
  produce: [
    { match: /\b(microgreen|microgreens|sprout|sprouts)\b/i, label: "Microgreens" },
    { match: /\b(lettuce|arugula|spinach|kale|chard|escarole|frisée|radicchio|romaine|mesclun|salad greens?|baby greens?|braising greens?)\b/i, label: "Greens" },
    { match: /\b(herb|basil|cilantro|parsley|mint|dill|thyme|rosemary|sage|chives?|tarragon|oregano)\b/i, label: "Herbs" },
    { match: /\b(pepper|chili|jalapeñ|jalapeno|poblano|shishito|bell|capsicum)\b/i, label: "Peppers" },
    { match: /\b(tomato|tomatoe|cherry tomato)\b/i, label: "Tomatoes" },
    { match: /\b(squash|zucchini|pumpkin|gourd|courgette)\b/i, label: "Squash" },
    { match: /\b(cucumber|cuke)\b/i, label: "Cucumbers" },
    { match: /\b(mushroom|mushrooms|shiitake|oyster|portobello|cremini)\b/i, label: "Mushrooms" },
    { match: /\b(onion|garlic|leek|shallot|scallion|chive)\b/i, label: "Alliums" },
    {
      match: /\b(potato|potatoes|carrot|carrots|beet|beets|radish|radishes|turnip|parsnip|rutabaga|fingerling|yukon|jerusalem artichoke|sunchoke)\b/i,
      label: "Roots",
    },
    {
      match: /\b(apple|pear|peach|plum|berry|berries|strawberr|raspberr|blackberr|blueberr|melon|watermelon|cantaloupe|grape|cherry|cherries)\b/i,
      label: "Fruit",
    },
    { match: /\b(corn|sweet corn|maize)\b/i, label: "Corn" },
    { match: /\b(broccoli|cauliflower|cabbage|brussels|kohlrabi)\b/i, label: "Brassicas" },
    { match: /\b(bean|beans|pea|peas|asparagus|fava|edamame)\b/i, label: "Legumes" },
    { match: /\b(eggplant|aubergine|okra|fennel)\b/i, label: "Specialty" },
    { match: /\b(clamshell|salad mix|salad)\b/i, label: "Clamshells" },
  ],
  pantry: [
    { match: /\b(flour|grain|rye|wheat|spelt|cornmeal|oats?)\b/i, label: "Grains & flour" },
    { match: /\b(oil|olive oil|sunflower oil|vegetable oil)\b/i, label: "Oils" },
    { match: /\b(vinegar)\b/i, label: "Vinegars" },
    { match: /\b(honey|maple syrup|maple|syrup|sugar|sweetener)\b/i, label: "Sweeteners" },
    { match: /\b(jam|jelly|preserve|spread|sauce|salsa|ketchup|mustard|relish|pickle|sauerkraut|kimchi|hot sauce)\b/i, label: "Sauces & spreads" },
    { match: /\b(granola|cereal|cracker|cookie|biscuit|bread|loaf|chip|chips|snack)\b/i, label: "Bakery & snacks" },
    { match: /\b(pasta|pierogi|pierogies|dumpling|noodle|ravioli|tortellini|gnocchi)\b/i, label: "Pasta & prepared" },
    { match: /\b(salt|spice|herb mix|seasoning|pepper)\b/i, label: "Salt & spices" },
  ],
  beverages: [
    { match: /\b(coffee|espresso)\b/i, label: "Coffee" },
    { match: /\btea\b/i, label: "Tea" },
    { match: /\b(juice|cider|lemonade)\b/i, label: "Juice & cider" },
    { match: /\b(soda|cola|seltzer|sparkling|tonic)\b/i, label: "Soda & sparkling" },
    { match: /\b(water|mineral water)\b/i, label: "Water" },
    { match: /\b(beer|wine|cider)\b/i, label: "Alcohol" },
    { match: /\b(kombucha|kvass|drinking vinegar|shrub)\b/i, label: "Fermented" },
  ],
};

const FALLBACK: Record<Category, string> = {
  meat: "Other meat",
  dairy: "Other dairy",
  cheese: "Cheese",
  produce: "Other produce",
  pantry: "Other pantry",
  beverages: "Other beverages",
};

export function subCategoryOf(
  name: string,
  category: Category,
  manualOverride?: string | null,
): string {
  // Admin-set value via the name-review CSV wins. Falls through to the
  // regex when the column is null/empty so unset products still bucket.
  const manual = manualOverride?.trim();
  if (manual) return manual;
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
 * and beverages categories (pantry items get "Sauces & spreads" etc.,
 * beverages items get "Coffee" / "Tea" etc.). Preserves the
 * first-appearance order of sub-categories so the parent query's sort
 * still drives which strip leads the page. Fallback "Other …" buckets
 * are pushed to the tail.
 */
export function groupBySubCategory<
  T extends Pick<Product, "name" | "category"> & { sub_category?: string | null },
>(items: T[]): { subCategory: string; items: T[] }[] {
  const order: string[] = [];
  const bucket = new Map<string, T[]>();
  const fallbackKeys = new Set<string>();
  for (const p of items) {
    const key = subCategoryOf(p.name, p.category, p.sub_category);
    if (FALLBACK[p.category] === key) fallbackKeys.add(key);
    if (!bucket.has(key)) {
      bucket.set(key, []);
      order.push(key);
    }
    bucket.get(key)!.push(p);
  }
  const named = order.filter((k) => !fallbackKeys.has(k));
  const fallbacks = order.filter((k) => fallbackKeys.has(k));
  return [
    ...named.map((k) => ({ subCategory: k, items: bucket.get(k)! })),
    ...fallbacks.map((k) => ({ subCategory: k, items: bucket.get(k)! })),
  ];
}
