import { displayProductName } from "@/lib/utils/product-display";
import type { Category } from "@/lib/supabase/types";

const CATEGORY_LABEL: Record<Category, string> = {
  meat: "Meat",
  dairy: "Dairy",
  cheese: "Cheese",
  produce: "Produce",
  pantry: "Pantry",
  beverages: "Beverages",
};

interface Props {
  product: {
    name: string;
    category: Category;
    producer: string | null;
    pack_size: string | null;
    case_pack: string | null;
    sub_category: string | null;
  };
  /**
   * Tile size determines whether the product name can fit as the focal
   * element. Tiny tiles (row variant, 80px) fall back to a producer
   * abbreviation since the name won't read.
   *   - sm  ≤ 120px wide  → producer abbreviation
   *   - md  120–360px     → product name forward (catalog/guide cards)
   *   - lg  > 360px       → product name + producer name (PDP hero)
   */
  size?: "sm" | "md" | "lg";
}

/**
 * Editorial no-photo tile. Brand-blue tint with a dot-grid texture; the
 * product name is the focal element (not the producer monogram) so a
 * shelf of fallbacks still reads as a shelf of products. Falls back to
 * a producer abbreviation in tile sizes too tight to fit a name.
 *
 * Designed to feel like intentional space, not a missing asset.
 */
export function ProductCardFallback({ product, size = "md" }: Props) {
  const eyebrow = product.sub_category?.trim() || CATEGORY_LABEL[product.category];
  const displayName = displayProductName(
    product.name,
    product.producer,
    product.pack_size,
    product.case_pack,
  );

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center text-center bg-brand-blue-tint text-brand-blue-dark"
      style={{
        backgroundImage:
          "radial-gradient(circle, rgba(23,99,181,0.16) 1px, transparent 1px)",
        backgroundSize: size === "sm" ? "6px 6px" : "10px 10px",
      }}
      aria-hidden
    >
      {size === "sm" ? <Compact product={product} eyebrow={eyebrow} /> : null}
      {size === "md" ? (
        <Medium eyebrow={eyebrow} name={displayName} producer={product.producer} />
      ) : null}
      {size === "lg" ? (
        <Large eyebrow={eyebrow} name={displayName} producer={product.producer} />
      ) : null}
    </div>
  );
}

function Compact({
  product,
  eyebrow,
}: {
  product: Props["product"];
  eyebrow: string;
}) {
  const abbr = monogram(product.producer ?? product.name);
  return (
    <div className="px-1.5">
      <div className="text-[8px] uppercase tracking-[0.1em] font-bold text-brand-blue/80 leading-none">
        {eyebrow}
      </div>
      <div className="display text-[20px] font-extrabold tracking-tighter text-brand-blue leading-none mt-1">
        {abbr}
      </div>
    </div>
  );
}

function Medium({
  eyebrow,
  name,
  producer,
}: {
  eyebrow: string;
  name: string;
  producer: string | null;
}) {
  return (
    <div className="px-3.5 max-w-full">
      <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-brand-blue/85 leading-none">
        {eyebrow}
      </div>
      <div className="display text-[15px] font-bold tracking-tight text-brand-blue leading-[1.15] mt-2 line-clamp-3">
        {name}
      </div>
      {producer ? (
        <div className="text-[11px] italic text-brand-blue-dark mt-1.5 line-clamp-1">
          {producer}
        </div>
      ) : null}
    </div>
  );
}

function Large({
  eyebrow,
  name,
  producer,
}: {
  eyebrow: string;
  name: string;
  producer: string | null;
}) {
  return (
    <div className="px-8 max-w-[28ch]">
      <div className="text-[12px] uppercase tracking-[0.12em] font-bold text-brand-blue/85 leading-none">
        {eyebrow}
      </div>
      <div className="display text-[32px] font-extrabold tracking-tighter text-brand-blue leading-[1.05] mt-4 line-clamp-4">
        {name}
      </div>
      {producer ? (
        <div className="text-[14px] italic text-brand-blue-dark mt-3">
          {producer}
        </div>
      ) : null}
    </div>
  );
}

/**
 * 2–3 character abbreviation for tiles too small to fit a product name.
 * - Two-word producer → both initials ("MC" for Meadow Creek)
 * - One-word producer ≤ 4 chars → full uppercase
 * - One-word longer → first 3 chars uppercase
 */
function monogram(s: string): string {
  const tokens = s.trim().split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    return (tokens[0][0] + tokens[1][0]).toUpperCase();
  }
  const t = tokens[0] ?? "";
  if (t.length <= 4) return t.toUpperCase();
  return t.slice(0, 3).toUpperCase();
}
