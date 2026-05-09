-- Two name cleanups so the buyer cards stop duplicating the producer chip
-- and the product detail page stops grouping different yogurt flavors as
-- if they were sibling pack sizes of one yogurt.
--
-- ─── 1. Five Acre Farms ─────────────────────────────────────────────────
-- DB has producer='Five Acre Farms' but names like "Five Acre Whole Milk
-- — Gallon" / "Five Acre 2% Reduced Fat Milk — Gallon". The card display
-- strips the producer prefix from the name so the chip doesn't duplicate
-- — but the strip looks for the FULL producer string ("Five Acre Farms"),
-- and the names only have "Five Acre" without "Farms". So nothing got
-- stripped and "Five Acre …" stayed in the visible card title next to
-- the "Five Acre Farms" chip.
--
-- Fix: drop the "Five Acre " word-boundary prefix from product names
-- whose producer is "Five Acre Farms". Producer chip stays "Five Acre
-- Farms"; name becomes "Whole Milk — Gallon" / "2% Reduced Fat Milk —
-- Gallon" and renders with no producer redundancy.
--
-- ─── 2. Ithaca Milk Yogurt ──────────────────────────────────────────────
-- Names: "Ithaca Milk Yogurt — Plain 6oz" / "… — Vanilla 6oz" / "… —
-- Maple 6oz". The product-detail card groups siblings by base name,
-- where base name is "everything before the trailing ' — Suffix'". For
-- yogurt that's "Ithaca Milk Yogurt" — every flavor — so all flavors got
-- collapsed onto one detail card as if they were size variants of one
-- yogurt. Different flavors are different products; only sizes should
-- group.
--
-- Restructure: "Ithaca Milk Yogurt — Plain 6oz" → "Yogurt, Plain — 6oz"
-- (drop producer prefix, comma-separate the flavor, keep the em-dash
-- size suffix so the grouping logic still pairs Plain 6oz with Plain
-- 32oz). The display fallback added in product-display.ts strips the
-- " — 6oz" suffix at render time, so the visible card title is
-- "Yogurt, Plain".
--
-- Idempotent: gates on the OLD pattern still being present.

-- 1. Drop "Five Acre " prefix.
update products
   set name = regexp_replace(name, '^Five Acre\s+', '')
 where producer = 'Five Acre Farms'
   and name ~ '^Five Acre\s+';

-- 2a. Reshape Ithaca Milk Yogurt names. The flavor list is closed — these
--     are the seven SKUs that exist (DY-YGP/V/B/L/C/M/PC/S — Plain,
--     Vanilla, Blueberry, Lemon, Black Cherry, Maple, Peach, Strawberry).
--     Anchor on "Ithaca Milk Yogurt — " followed by flavor + size.
update products
   set name = regexp_replace(
                name,
                '^Ithaca Milk Yogurt\s+—\s+(Plain|Vanilla|Blueberry|Strawberry|Black Cherry|Lemon|Maple|Peach)\s+(\d+\s*oz)$',
                'Yogurt, \1 — \2'
              )
 where producer = 'Ithaca Milk'
   and name ~ '^Ithaca Milk Yogurt\s+—\s+(Plain|Vanilla|Blueberry|Strawberry|Black Cherry|Lemon|Maple|Peach)\s+\d+\s*oz$';

-- 2b. Belt-and-suspenders: any leftover "Ithaca Milk Yogurt — X" rows whose
--     suffix didn't match the strict flavor + size pattern (typo, extra
--     descriptor, …) — at least drop the producer prefix so the card
--     title stops echoing the chip. Conservative: only touches rows that
--     still have the literal old prefix.
update products
   set name = regexp_replace(name, '^Ithaca Milk Yogurt\s+—\s+', 'Yogurt, ')
 where producer = 'Ithaca Milk'
   and name ~ '^Ithaca Milk Yogurt\s+—\s+';
