-- TCR / CTIA A2P 10DLC compliance: explicit, default-off SMS opt-in.
--
-- The OTP flow (Twilio Verify) is a separate carrier classification and
-- doesn't require this consent. This flag gates *transactional* SMS:
-- order confirmations, delivery updates, standing-order ready, reorder
-- prompts, etc.
--
-- Default false. Users opt in by checking the (unchecked-by-default)
-- checkbox at /login or /register. The timestamp + source columns let
-- us produce evidence if TCR ever audits a specific number.

alter table profiles
  add column if not exists sms_opted_in boolean not null default false,
  add column if not exists sms_opt_in_at timestamptz,
  add column if not exists sms_opt_in_source text;
-- sms_opt_in_source values: 'login' | 'register' | 'admin'
