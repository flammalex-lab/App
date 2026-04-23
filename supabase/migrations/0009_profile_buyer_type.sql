-- =========================
-- Per-buyer buyer_type override
-- =========================
-- Until now buyer_type lived only on accounts (see 0006_buyer_groups.sql),
-- which meant every buyer at an account saw the same catalog.
--
-- This migration adds a buyer_type column to profiles as an optional
-- override. When set, it takes precedence over account.buyer_type when
-- resolving which product groups a buyer sees on /catalog and /guide.
--
-- Behaviour:
--   profile.buyer_type IS NOT NULL  → use profile.buyer_type
--   profile.buyer_type IS NULL      → fall back to account.buyer_type
--
-- No backfill — existing buyers inherit their account's buyer_type
-- through the fallback, so nothing changes for them.

alter table profiles
  add column if not exists buyer_type text;

comment on column profiles.buyer_type is
  'Optional per-buyer override of account.buyer_type. When set, drives the
   catalog group filter (allowedGroupsFor). Valid values match the same
   BuyerType enum in src/lib/constants.ts.';
