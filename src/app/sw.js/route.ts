import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Service worker is served from a route handler so we can stamp the
 * current build id into the cache name. Without a per-deploy version,
 * the SW serves the prior shell forever after a deploy (CLAUDE.md
 * already calls this out as a recurring "I don't see my changes" symptom).
 *
 * Build-id resolution (in priority order, all stable across instances):
 *   1. VERCEL_GIT_COMMIT_SHA — auto-set on Vercel deploys
 *   2. NEXT_PUBLIC_BUILD_ID — opt-in env override
 *   3. .next/BUILD_ID — written by `next build`, identical across
 *      instances of the same deploy. Works for self-hosted serverless
 *      where multiple workers handle the same release; a per-process
 *      random would have caused cache thrashing as clients moved
 *      between instances.
 *   4. Dev — `dev-${Date.now()}`, captured once per process so HMR
 *      doesn't churn within a single `next dev` session.
 */
function readNextBuildId(): string | null {
  try {
    return readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf-8").trim() || null;
  } catch {
    return null;
  }
}

const PROD_BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
  process.env.NEXT_PUBLIC_BUILD_ID ??
  readNextBuildId();
const DEV_BUILD_ID = `dev-${Date.now()}`;
const BUILD_ID =
  PROD_BUILD_ID ?? (process.env.NODE_ENV === "production" ? null : DEV_BUILD_ID);
if (!BUILD_ID) {
  // Don't ship a SW with a frozen / per-instance build id — but don't
  // 500 either, since that would just have all clients see fetch errors.
  // We serve a no-op SW below that immediately unregisters itself, so
  // the app keeps working (no offline cache, no stale shell) while the
  // operator gets a loud nudge in the logs to set NEXT_PUBLIC_BUILD_ID
  // (or copy .next/ into the deploy image).
  console.error(
    "[sw] No VERCEL_GIT_COMMIT_SHA, NEXT_PUBLIC_BUILD_ID, or .next/BUILD_ID found in production. " +
      "Serving a no-op self-unregistering service worker until one is set.",
  );
}

// Self-unregistering SW. Registers cleanly, then immediately removes
// itself + clears every cache it owned. App falls back to a non-PWA
// experience (no offline shell), which is strictly better than serving
// the wrong cached shell or a 500 to every client on every poll.
const NOOP_SW = `self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
      self.registration.unregister().then(() => self.clients.matchAll().then((cs) => cs.forEach((c) => c.navigate(c.url)))),
    ]),
  );
});
`;

const SW = `// Generated at request time. CACHE bumps on every deploy so a stale
// shell can't be served after a release.
const CACHE = "flf-${BUILD_ID}";
// Precache is limited to static app-shell assets only. Route HTML is
// deliberately excluded: on a shared device, a signed-out cookie cannot
// strip a cached HTML body, so a per-buyer route cached under one
// session would leak to the next user. HTML always hits the network;
// Next.js + the CDN already cache HTML where appropriate.
const SHELL = ["/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never cache API / auth / cron
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/auth")) return;

  const cacheable = (res) =>
    res && res.ok && res.status >= 200 && res.status < 300;

  // HTML navigations: always go straight to the network, never cache.
  // This is the polarity flip — an opt-out list of "buyer routes" is
  // fragile (any future per-account page added without the prefix would
  // leak across sessions on shared devices). The SW adds no value over
  // the network for HTML; Next.js + the CDN handle HTML caching.
  if (req.mode === "navigate") return;

  // Immutable Next.js build output — safe to cache long. Hashed filenames
  // change every deploy, so staleness self-resolves.
  if (url.pathname.startsWith("/_next/static")) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const net = fetch(req)
          .then((res) => {
            if (cacheable(res)) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || net;
      }),
    );
    return;
  }

  // Image assets — cache-first with a network refresh. These are not
  // buyer-scoped and stale-while-revalidate is the right tradeoff for
  // offline / flaky-mobile use.
  if (url.pathname.match(/\\.(jpg|jpeg|png|webp|gif|svg|ico)$/)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const net = fetch(req)
          .then((res) => {
            if (cacheable(res)) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || net;
      }),
    );
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || "Fingerlakes Farms", {
      body: data.body || "",
      icon: "/images/flf-logo.png",
      badge: "/images/flf-logo.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
`;

export async function GET() {
  const body = BUILD_ID ? SW : NOOP_SW;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}
