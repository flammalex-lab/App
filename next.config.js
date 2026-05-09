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
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://q.stripe.com https://r.stripe.com https://api.twilio.com",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "worker-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      ...supabaseImagePatterns(),
      // Unsplash kept for placeholder images during dev.
      { protocol: "https", hostname: "images.unsplash.com" },
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
