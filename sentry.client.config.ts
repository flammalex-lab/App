// Sentry browser SDK init. Runs once per page load, after hydration.
// The SDK no-ops automatically when `dsn` is undefined, so leaving
// NEXT_PUBLIC_SENTRY_DSN unset in dev / preview is safe — no events
// are queued, no network calls made.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Off in dev to keep the console / network panel clean. Vercel sets
  // NODE_ENV=production for both preview and production builds, so
  // preview deploys will report — wire a separate DSN there if you
  // want preview isolated from prod.
  enabled: process.env.NODE_ENV === "production",
  // 10% of transactions. Bump cautiously; performance events are the
  // dominant cost driver on Sentry's pricing.
  tracesSampleRate: 0.1,
  // No session replay by default — buyer carts / order lines are PII
  // adjacent and replay storage is expensive. We do capture replays on
  // errored sessions for triage (50% of errors get a replay attached).
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.5,
});
