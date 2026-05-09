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
  // Fail fast: refuse to ship a SW with a frozen / per-instance build id.
  // The /sw.js route returns 500 below until the operator sets one of the
  // accepted env vars or runs a real `next build`.
  console.error(
    "[sw] No VERCEL_GIT_COMMIT_SHA, NEXT_PUBLIC_BUILD_ID, or .next/BUILD_ID found in production. " +
      "Service worker will return 500 until one is set.",
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
  if (!BUILD_ID) {
    return NextResponse.json(
      { error: "Service worker disabled: no stable BUILD_ID configured" },
      { status: 500 },
    );
  }
  return new NextResponse(SW, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}
