// Sentry Edge-runtime init. Loaded for middleware + any route handler
// exporting `runtime = "edge"`. The SDK no-ops automatically when
// `dsn` is undefined.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled:
    process.env.NODE_ENV === "production" && process.env.NEXT_RUNTIME != null,
  tracesSampleRate: 0.1,
});
