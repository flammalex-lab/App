-- Drop "Gotham" / "Gotham Greens" prefix from product names where producer
-- is "Gotham Greens". Same class of fix as 0024 for Five Acre Farms — the
-- card title's producer-prefix strip looks for the FULL producer string
-- ("Gotham Greens "), so any name that only has "Gotham " (no "Greens")
-- never gets stripped and reads alongside the producer chip with the
-- producer half-echoed in the title.
--
-- Examples in production:
--   "Gotham Greens Basil"         → strip works → "Basil"           (already fine)
--   "Gotham Pesto"                → strip fails → "Gotham Pesto"   (this fixes it)
--   "Gotham Buffalo Dip"          → strip fails → "Gotham Buffalo Dip"
--   "Gotham VEGAN Pesto"          → strip fails → "Gotham VEGAN Pesto"
--
-- Order matters: strip "Gotham Greens " FIRST so we don't accidentally
-- turn "Gotham Greens Basil" into "Greens Basil" by matching the shorter
-- "Gotham " prefix.
--
-- Idempotent: gates on the prefix still being present.

-- 1. Drop the longer "Gotham Greens " prefix.
update products
   set name = regexp_replace(name, '^Gotham Greens\s+', '')
 where producer = 'Gotham Greens'
   and name ~ '^Gotham Greens\s+';

-- 2. Drop the shorter "Gotham " prefix on rows that didn't have "Greens".
update products
   set name = regexp_replace(name, '^Gotham\s+', '')
 where producer = 'Gotham Greens'
   and name ~ '^Gotham\s+';
