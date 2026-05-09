/**
 * Strip producer prefix and pack-size suffix from a product name so the
 * card title doesn't duplicate info already shown elsewhere on the card.
 *
 * Example: "Five Acre 2% Reduced Fat — Gallon" with
 *   producer = "Five Acre", packSize = "Gallon"
 * becomes "2% Reduced Fat" (the producer is rendered above the name and
 * the size is rendered next to the price).
 *
 * Conservative — only strips exact matches. Falls back to the original
 * name if everything would get stripped.
 */
export function displayProductName(
  name: string,
  producer?: string | null,
  packSize?: string | null,
  casePack?: string | null,
): string {
  let n = (name ?? "").trim();
  if (!n) return name ?? "";

  // 1. Strip producer prefix (case-insensitive). Allows the producer
  //    name to be a multi-word prefix like "Five Acre" or "Ithaca Milk".
  if (producer) {
    const p = producer.trim();
    if (p && n.toLowerCase().startsWith(p.toLowerCase() + " ")) {
      n = n.slice(p.length).trim();
    }
  }

  // 2. Strip trailing " — {size}" / " - {size}" / " · {size}". Tries
  //    case_pack first, then pack_size. Em-dash, en-dash, hyphen, and
  //    middot all accepted as separators.
  const sizes = [casePack, packSize].filter((s): s is string => !!s && !!s.trim());
  for (const raw of sizes) {
    const s = raw.trim();
    const re = new RegExp(`\\s*[—–·-]\\s*${escapeRegex(s)}\\s*$`, "i");
    if (re.test(n)) {
      n = n.replace(re, "").trim();
    }
  }

  // 3. Fallback: strip a generic trailing " — Suffix" (em-dash, en-dash, or
  //    middot) if one survived. Catches products whose name suffix doesn't
  //    literally match pack_size — e.g. "Yogurt, Plain — 6oz" with
  //    pack_size "12/6 oz". Mirrors baseNameForGrouping in catalog packs.ts.
  const trailingSuffix = /\s+[—–·]\s+[^—–·]+\s*$/;
  if (trailingSuffix.test(n)) {
    const stripped = n.replace(trailingSuffix, "").trim();
    if (stripped) n = stripped;
  }

  return n || name;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
