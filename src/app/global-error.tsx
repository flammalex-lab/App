"use client";

// App Router top-level error boundary. Catches errors thrown in the
// root layout itself (which `error.tsx` does NOT cover — that one is
// nested inside the layout). Sentry's Next.js SDK requires this file
// to report client-side render errors at the root.
//
// Keep it dependency-light: this renders when the rest of the layout
// has already failed, so anything fancy is a second-order crash risk.
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
            Something went wrong
          </h1>
          <p style={{ marginBottom: "1rem", color: "#555" }}>
            We&apos;ve been notified. Please try again, or come back in a few
            minutes.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "0.5rem 1rem",
              border: "1px solid #1763B5",
              background: "#1763B5",
              color: "white",
              borderRadius: "0.25rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
