// Next.js instrumentation hook. Called once per worker boot, before any
// request is served. We route the import based on NEXT_RUNTIME so the
// server config (Node-only APIs) doesn't get pulled into the edge
// bundle and vice versa.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Wires server-side request errors (React Server Components, route
// handlers) into Sentry. Without this, errors raised inside an RSC
// surface as a generic 500 to the client with nothing in the logs
// beyond Next's default trace.
export const onRequestError = Sentry.captureRequestError;
