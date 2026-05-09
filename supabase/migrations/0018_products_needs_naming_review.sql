-- Naming-review flag for the post-onboarding name finalization pass.
--
-- Products imported from QuickBooks come in with the QB short-code names
-- (e.g. "BEEF GR 80/20 5#") which aren't appropriate for the buyer-facing
-- catalog. Admin runs a CSV round-trip via /admin/products/name-review:
-- export the pending list, edit names + pack_size in a spreadsheet, set
-- this flag false on rows that are finalized, re-upload.
--
-- Default true so every existing row enters the review queue. New rows
-- created via /admin/items-import also start true (the import path
-- doesn't override the default).

alter table products
  add column if not exists needs_naming_review boolean not null default true;

-- Partial index — only the unreviewed rows are interesting to query.
-- Once the queue empties, this index is essentially zero-cost.
create index if not exists idx_products_needs_naming_review
  on products (needs_naming_review)
  where needs_naming_review = true;

comment on column products.needs_naming_review is
  'True until an admin has finalized the buyer-facing name + pack_size.
   Drives the /admin/products/name-review queue. Toggled to false via
   the CSV re-upload flow once a product is camera-ready.';
