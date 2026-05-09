import { NextResponse } from "next/server";

/**
 * Service worker is served from a route handler so we can stamp the
 * current build SHA into the cache name. Without a per-deploy version,
 * the SW serves the prior shell forever after a deploy (CLAUDE.md
 * already calls this out as a recurring "I don't see my changes" symptom).
 *
 * Vercel sets VERCEL_GIT_COMMIT_SHA automatically; locally we fall back
 * to the process start time so a `next dev` restart bumps the version.
 */
// Prefer Vercel's commit SHA. Self-hosted production deploys should set
// NEXT_PUBLIC_BUILD_ID at build time (e.g. `NEXT_PUBLIC_BUILD_ID=$(git rev-parse --short HEAD) next build`)
// so the cache name bumps on every release. Date.now() is captured *once*
// at module load — that's fine for `next dev` (gives a fresh shell per
// server restart) but in production we'd be reusing the same string
// across every deploy, so we stamp 'prod-unknown' and warn loudly so the
// missing build-id is impossible to miss in the logs.
const PROD_BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? process.env.NEXT_PUBLIC_BUILD_ID ?? null;
const DEV_BUILD_ID = `dev-${Date.now()}`;
const BUILD_ID =
  PROD_BUILD_ID ?? (process.env.NODE_ENV === "production" ? "prod-unknown" : DEV_BUILD_ID);
if (!PROD_BUILD_ID && process.env.NODE_ENV === "production") {
  console.warn(
    "[sw] No VERCEL_GIT_COMMIT_SHA or NEXT_PUBLIC_BUILD_ID set in production — " +
      "service-worker cache name will not bump between deploys. Set NEXT_PUBLIC_BUILD_ID at build time.",
  );
}

const SW = `// Generated at request time. CACHE bumps on every deploy so a stale
// shell can't be served after a release.
const CACHE = "flf-${BUILD_ID}";
const SHELL = ["/", "/guide", "/catalog", "/manifest.json"];

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

  // Only cache 2xx responses without Set-Cookie. Caching errors / redirects
  // / Set-Cookie pins them into the SW cache and serves them indefinitely.
  const cacheable = (res) =>
    res && res.ok && res.status >= 200 && res.status < 300 && !res.headers.get("set-cookie");

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (cacheable(res)) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/"))),
    );
    return;
  }

  if (url.pathname.startsWith("/_next") || url.pathname.match(/\\.(png|jpg|jpeg|webp|svg|ico|css|js|woff2?)$/)) {
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
  return new NextResponse(SW, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}
