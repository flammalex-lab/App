import type { Category } from "@/lib/supabase/types";

/**
 * Fallback imagery until real product photos are uploaded to Supabase Storage.
 * Uses category-level placeholders: a gradient SVG with the category name.
 *
 * When a product gets a real image_url set, that takes precedence. This just
 * ensures the catalog and guide look intentional instead of grey boxes.
 */

const CAT_COLOR: Record<Category, { from: string; to: string; label: string }> = {
  beef:    { from: "#9D3123", to: "#5E1A13", label: "Beef" },
  pork:    { from: "#D49BA0", to: "#A8525C", label: "Pork" },
  eggs:    { from: "#E9C96B", to: "#A37C17", label: "Eggs" },
  dairy:   { from: "#E7EEF7", to: "#B1C1D6", label: "Dairy" },
  produce: { from: "#7BB26B", to: "#355E2A", label: "Produce" },
};

/**
 * Returns a data: URL SVG placeholder tinted to the product category.
 * Inline so it's visible immediately (no external image fetch).
 */
export function categoryPlaceholder(category: Category, label?: string): string {
  const { from, to, label: fallbackLabel } = CAT_COLOR[category];
  const shown = (label ?? fallbackLabel).slice(0, 14);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="120" height="90" fill="url(#g)"/>
  <text x="60" y="50" font-family="Georgia, serif" font-weight="700"
        font-size="12" fill="rgba(255,255,255,0.88)" text-anchor="middle"
        dominant-baseline="middle">${escapeXml(shown)}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Returns the best image for a product: real image_url if present, else
 * a category placeholder.
 */
export function productImage(p: { image_url: string | null; category: Category; name: string }): string {
  return p.image_url ?? categoryPlaceholder(p.category, p.name);
}

/**
 * Returns a larger, more editorial placeholder for category tiles on /catalog.
 */
export function categoryTileImage(category: Category): string {
  return categoryPlaceholder(category);
}
