import { NextResponse } from "next/server";

// Universal Links manifest served at /.well-known/apple-app-site-association.
// When this file is reachable AND signed by the right team, taps on
// fingerlakesfarms.com links (in iMessage, Safari, etc.) open inside the
// installed native app instead of bouncing through Safari.
//
// Apple's CDN caches aggressively, so changes can take ~24h to propagate
// to devices. The file must be served with Content-Type: application/json
// and no redirects.
//
// Returns 404 until IOS_APP_TEAM_ID is set — without a real team prefix
// the file is just misleading. Set when the Apple Developer enrollment
// completes:
//   IOS_APP_TEAM_ID=ABCDE12345
//   IOS_APP_BUNDLE_ID=com.fingerlakesfarms.portal   # if you change the default

export const dynamic = "force-dynamic";

const STOREFRONT_PATHS = [
  "/guide",
  "/catalog",
  "/catalog/*",
  "/cart",
  "/cart/*",
  "/orders",
  "/orders/*",
  "/standing",
  "/standing/*",
  "/account",
  "/chat",
];

export function GET() {
  const teamId = process.env.IOS_APP_TEAM_ID;
  const bundleId = process.env.IOS_APP_BUNDLE_ID ?? "com.fingerlakesfarms.portal";
  if (!teamId) {
    return new NextResponse(null, { status: 404 });
  }
  const body = {
    applinks: {
      apps: [],
      details: [
        {
          appID: `${teamId}.${bundleId}`,
          paths: STOREFRONT_PATHS,
        },
      ],
    },
  };
  return new NextResponse(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
