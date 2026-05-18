"use client";

// Light-weight client-side event tracker. Fires fire-and-forget POSTs to
// /api/track; never throws, never blocks the UI. Session id is generated
// once and persisted in localStorage so multiple tabs/visits share a
// session for funnel analysis.

const SESSION_KEY = "flf-session-id";
let cachedSessionId: string | null = null;

function getSessionId(): string {
  if (cachedSessionId) return cachedSessionId;
  if (typeof window === "undefined") return "";
  try {
    let s = window.localStorage.getItem(SESSION_KEY);
    if (!s) {
      s = (crypto as Crypto).randomUUID();
      window.localStorage.setItem(SESSION_KEY, s);
    }
    cachedSessionId = s;
    return s;
  } catch {
    return "";
  }
}

export type TrackProps = Record<string, string | number | boolean | null | undefined>;

export function track(event: string, properties: TrackProps = {}): void {
  if (typeof window === "undefined") return;
  // jsdom in tests, some SSR fallbacks, and very early hydration can
  // leave window.location undefined — never let a missing property
  // bubble up to the caller (cart store, etc.).
  const loc = window.location;
  if (!loc) return;
  const body = JSON.stringify({
    events: [
      {
        event,
        properties,
        path: (loc.pathname ?? "") + (loc.search ?? ""),
        sessionId: getSessionId(),
      },
    ],
  });
  // keepalive so events fire even if the user navigates away during
  // the request (e.g. tracking checkout_started right before a route
  // change).
  try {
    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // Swallow — tracking is best-effort. Never let it surface to the user.
    });
  } catch {
    // Same — fetch can throw synchronously on some quota errors.
  }
}
