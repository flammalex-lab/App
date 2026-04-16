-- One-paste loader: runs all 5 real-catalog seed files in order.
-- Run this instead of the individual files if you prefer one paste.
--
-- Requires setup.sql (core schema) to have been run first.
--
-- Safe to re-run — all inserts use ON CONFLICT (sku) DO NOTHING.

-- 0. Add the new product categories (pantry, beverages, lamb)
do $$ begin
  alter type category_t add value if not exists 'pantry';
  alter type category_t add value if not exists 'beverages';
  alter type category_t add value if not exists 'lamb';
exception when duplicate_object then null;
end $$;

-- That's the only schema change; now paste the contents of:
--   seed-real-catalog.sql
--   seed-real-catalog-2.sql
--   seed-real-catalog-3.sql
--   seed-real-catalog-4.sql
--   seed-real-catalog-5.sql
-- in order. Or run each file individually — either way works.
--
-- To help the copy-paste, here's a shell one-liner you can run from
-- the repo root to concatenate all 5 files to the clipboard:
--
--   cat supabase/migrations/0004_add_categories.sql \
--       supabase/seed-real-catalog.sql \
--       supabase/seed-real-catalog-2.sql \
--       supabase/seed-real-catalog-3.sql \
--       supabase/seed-real-catalog-4.sql \
--       supabase/seed-real-catalog-5.sql | pbcopy
--
-- Then paste into Supabase SQL Editor and Run. Done in one shot.
