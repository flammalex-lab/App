-- Cron observability (M2).
--
-- Today the two cron routes (reorder-prompts, standing-orders) write nothing
-- to the database when they no-op or when they crash mid-run. The only signal
-- of a silent failure is the absence of downstream rows (a notification that
-- never went out, a standing order whose next_run_date didn't advance) —
-- which by definition is invisible. notifications.status doesn't have an
-- 'errored' label either, so even partial dispatch failures get swallowed.
--
-- This table is a per-invocation audit log:
--   * one row inserted on cron entry (status='ok', started_at=now())
--   * updated at the end with finished_at + rows_affected on success
--   * updated to status='errored' + error message on failure
--
-- The admin /admin/cron page reads the last 7 days and surfaces failures.
--
-- Idempotent: gated on table existence.

create table if not exists cron_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,
  status text not null check (status in ('ok', 'errored')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rows_affected int,
  error text,
  metadata jsonb
);

comment on table cron_runs is
  'Per-invocation audit log for /api/cron/* routes. Row inserted on entry, '
  'updated on completion. status=errored + error column on failure. Read by '
  '/admin/cron; admin-only via RLS, writes are service-role only.';

create index if not exists idx_cron_runs_job_started_at
  on cron_runs (job, started_at desc);

alter table cron_runs enable row level security;

-- Admin read only. Writes happen exclusively via the service-role client in
-- the cron route handlers, which bypasses RLS — so we intentionally do not
-- define any insert/update policies. authenticated buyers see nothing.
drop policy if exists "cron_runs admin read" on cron_runs;
create policy "cron_runs admin read" on cron_runs
  for select using (is_admin());
