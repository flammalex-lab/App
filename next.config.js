/** @type {import('next').NextConfig} */

// Pin image optimizer to the configured Supabase project when available, so
// the optimizer doesn't fan out to arbitrary *.supabase.co subdomains.
// Falls back to the wildcard for dev convenience when the URL isn't set.
function supabaseImagePatterns() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return [{ protocol: "https", hostname: "*.supabase.co" }];
  try {
    const hostname = new URL(url).hostname;
    return [{ protocol: "https", hostname }];
  } catch {
    return [{ protocol: "https", hostname: "*.supabase.co" }];
  }
}

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()" },
  // Conservative starter CSP. 'unsafe-inline' on styles is required by
  // Tailwind's runtime; scripts use 'unsafe-inline' + 'unsafe-eval' for
  // Next.js inline boot scripts (drop these once you adopt strict CSP nonces).
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://m.stripe.network",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.twilio.com",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
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
