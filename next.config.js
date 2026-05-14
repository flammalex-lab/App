/** @type {import('next').NextConfig} */

// Pin image optimizer to the configured Supabase project. Production must
// have a valid NEXT_PUBLIC_SUPABASE_URL — otherwise we'd silently widen
// the optimizer surface to *.supabase.co (the regression M10 was meant to
// prevent). Dev falls back to the wildcard for convenience.
function supabaseImagePatterns() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const isProd = process.env.NODE_ENV === "production";
  if (!url) {
    if (isProd) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL must be set in production. " +
          "Refusing to fall back to the *.supabase.co wildcard for the image optimizer.",
      );
    }
    return [{ protocol: "https", hostname: "*.supabase.co" }];
  }
  try {
    const hostname = new URL(url).hostname;
    return [{ protocol: "https", hostname }];
  } catch (e) {
    if (isProd) {
      throw new Error(
        `NEXT_PUBLIC_SUPABASE_URL is set but not a valid URL (${url}). ` +
          "Fix it; refusing to fall back to the *.supabase.co wildcard.",
      );
    }
    return [{ protocol: "https", hostname: "*.supabase.co" }];
  }
}

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()" },
  // Starter CSP. NOTE: `script-src 'unsafe-inline'` still defangs the
  // headline XSS-mitigation value of CSP — Next's runtime injects inline
  // boot scripts. The other directives (frame-ancestors, base-uri,
  // form-action) earn their keep regardless. We dropped 'unsafe-eval'
  // since Next 16 only needs it in dev. TODO(audit-followup): adopt
  // nonce-based CSP — generate a nonce in middleware, attach to <Script
  // nonce>, and Next's auto-injected inline scripts; then drop
  // 'unsafe-inline' too.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://js.stripe.com https://m.stripe.network",
      "style-src 'self' 'unsafe-inline'",
      // Narrowed from the open `https:` allowlist to just the hosts we
      // actually serve images from: Supabase Storage (product photography
      // when it lands), data: URIs (the gradient SVGs in catalog/page.tsx),
      // and blob: (next/image cache). Tighter SSRF / exfil surface; if a
      // future feature needs another host, add it explicitly here.
      "img-src 'self' data: blob: https://*.supabase.co",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://q.stripe.com https://r.stripe.com https://api.twilio.com",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "worker-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      // Tells browsers to upgrade any leftover http:// sub-resource to
      // https:// before fetching. (Note: `block-all-mixed-content` is
      // deprecated in favor of this and modern browsers ignore it, so
      // we don't ship it.)
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // staleTimes disabled to fix B3 — `TypeError: Cannot read properties
  // of null (reading 'parentNode')` from Next's inline $RS() streaming
  // helper, firing once per item on catalog pages (193x on
  // /catalog?group=dairy). The warm router cache held now-unmounted
  // Suspense placeholder trees alive long enough that $RS tried to
  // reconcile against a parentNode that React had already detached
  // during soft-nav stream resolve. See
  // docs/audits/2026-05-14-full-code-audit.md (Wave 2 row #12).
  // If we miss the perceived-snappy nav this gave us, the right
  // re-introduction is per-route loading.tsx + explicit <Suspense>
  // boundaries, not a global cache extension.
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
  images: {
    remotePatterns: [
      ...supabaseImagePatterns(),
    ],
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
