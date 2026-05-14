-- 0042 — Peak / In Season badge for products
--
-- Adds `is_peak boolean` to products. Admin opts a product in when its
-- season is at peak (Baldor-style "Peak" pill). Default is false so the
-- catalog is quiet by default — only flagged products surface the badge.
--
-- Distinct from the existing `in_season` column from 0001 (which defaults
-- true and effectively gates whether a product appears at all). is_peak
-- is a stronger marketing signal layered on top.

alter table products
  add column if not exists is_peak boolean not null default false;

comment on column products.is_peak is
  'Marketing flag — show a "Peak" / "In Season" badge on the catalog card. Admin-set; defaults to false.';
