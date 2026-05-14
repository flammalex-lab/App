// Sentry Node-runtime init. Loaded via `instrumentation.ts` on server
// boot; covers route handlers, server components, server actions, and
// the long-running cron workers. The SDK no-ops automatically when
// `dsn` is undefined.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Off in dev. Also off whenever NEXT_RUNTIME is unset (which is the
  // case under Jest / ts-node) — keeps Sentry out of unit tests where
  // its global hooks would otherwise sit on every fetch.
  enabled:
    process.env.NODE_ENV === "production" && process.env.NEXT_RUNTIME != null,
  tracesSampleRate: 0.1,
});
