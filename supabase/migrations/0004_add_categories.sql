-- Add new product categories to match the real FLF weekly flyer.
-- Safe to re-run.

do $$ begin
  alter type category_t add value if not exists 'pantry';
  alter type category_t add value if not exists 'beverages';
  alter type category_t add value if not exists 'lamb';
exception when duplicate_object then null;
end $$;
