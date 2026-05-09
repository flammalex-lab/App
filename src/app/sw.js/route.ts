import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

/**
 * Service worker is served from a route handler so we can stamp the
 * current build SHA into the cache name. Without a per-deploy version,
 * the SW serves the prior shell forever after a deploy (CLAUDE.md
 * already calls this out as a recurring "I don't see my changes" symptom).
 *
 * Build-id resolution:
 *   1. VERCEL_GIT_COMMIT_SHA — auto-set on Vercel deploys
 *   2. NEXT_PUBLIC_BUILD_ID — opt-in for self-hosted prod
 *      (e.g. `NEXT_PUBLIC_BUILD_ID=$(git rev-parse --short HEAD) next build`)
 *   3. Self-hosted prod fallback — random UUID captured at module load.
 *      Each cold start at least bumps the cache name (suboptimal: forces
 *      a re-fetch of the shell on every server boot, but better than a
 *      frozen string that never invalidates).
 *   4. Dev — `dev-${Date.now()}`, stable per process so HMR works.
 */
const PROD_BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? process.env.NEXT_PUBLIC_BUILD_ID ?? null;
const DEV_BUILD_ID = `dev-${Date.now()}`;
const PROD_FALLBACK = `prod-${randomUUID().slice(0, 12)}`;
const BUILD_ID =
  PROD_BUILD_ID ?? (process.env.NODE_ENV === "production" ? PROD_FALLBACK : DEV_BUILD_ID);
if (!PROD_BUILD_ID && process.env.NODE_ENV === "production") {
  console.warn(
    "[sw] No VERCEL_GIT_COMMIT_SHA or NEXT_PUBLIC_BUILD_ID set in production — " +
      `using per-process fallback "${PROD_FALLBACK}". The shell will be re-fetched on every cold start. ` +
      "Set NEXT_PUBLIC_BUILD_ID at build time to fix.",
  );
}

const SW = `// Generated at request time. CACHE bumps on every deploy so a stale
// shell can't be served after a release.
const CACHE = "flf-${BUILD_ID}";
const SHELL = ["/", "/guide", "/catalog", "/manifest.json"];

// Auth-sensitive paths whose responses must never land in the SW cache.
// /api and /auth are excluded earlier; this list catches anything that
// renders per-account or per-buyer content. (Set-Cookie filtering is
// useless here: the Fetch spec lists Set-Cookie as a forbidden response
// header, so the SW can't read it.)
const NEVER_CACHE_PREFIXES = [
  "/account",
  "/admin",
  "/orders",
  "/standing",
  "/cart",
  "/chat",
  "/login",
  "/register",
];
function isCacheableUrl(pathname) {
  for (const p of NEVER_CACHE_PREFIXES) if (pathname === p || pathname.startsWith(p + "/")) return false;
  return true;
}

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

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (cacheable(res) && isCacheableUrl(url.pathname)) {
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
