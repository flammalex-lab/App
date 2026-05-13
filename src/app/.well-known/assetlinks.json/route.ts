import { NextResponse } from "next/server";

// Android App Links Digital Asset Links manifest. Serving this at
// /.well-known/assetlinks.json with a matching SHA-256 fingerprint of
// the upload keystore tells Android "this domain belongs to this app,"
// so deep links open inside the installed app without the disambiguation
// dialog.
//
// Returns 404 until ANDROID_APP_SHA256_FINGERPRINT is set — empty
// fingerprints break verification rather than degrade silently. Comma-
// separate multiple fingerprints (upload key + Play App Signing key)
// when the app moves into Play App Signing.
//
//   ANDROID_APP_SHA256_FINGERPRINT=AB:CD:EF:...
//   ANDROID_APP_PACKAGE_ID=com.fingerlakesfarms.portal   # if changed

export const dynamic = "force-dynamic";

export function GET() {
  const fingerprintEnv = process.env.ANDROID_APP_SHA256_FINGERPRINT;
  const packageId =
    process.env.ANDROID_APP_PACKAGE_ID ?? "com.fingerlakesfarms.portal";
  if (!fingerprintEnv) {
    return new NextResponse(null, { status: 404 });
  }
  const fingerprints = fingerprintEnv
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  const body = [
    {
      relation: [
        "delegate_permission/common.handle_all_urls",
        "delegate_permission/common.get_login_creds",
      ],
      target: {
        namespace: "android_app",
        package_name: packageId,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
  return new NextResponse(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
