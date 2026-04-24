import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Generate a one-time magic sign-in link for any user (buyer or admin).
 * Admin-only. Exists so we can onboard + test specific users while
 * A2P 10DLC is pending and phone OTP delivery is blocked at the carrier.
 *
 * The link is produced by Supabase's admin.generateLink; it's single-use,
 * expires (default 1h), and authenticates the user on click. Admin pastes
 * the URL into the user's preferred channel (personal SMS, email, Slack).
 */
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }

  const { profileId } = (await request.json()) as { profileId?: string };
  if (!profileId) {
    return NextResponse.json({ error: "profileId required" }, { status: 400 });
  }

  const svc = createServiceClient();

  // Resolve the auth.users row for this profile to get the email that
  // generateLink needs. Supabase auth + profiles share the same UUID.
  const { data: authUser, error: getErr } = await svc.auth.admin.getUserById(profileId);
  if (getErr || !authUser?.user) {
    return NextResponse.json(
      { error: `user not found: ${getErr?.message ?? "unknown"}` },
      { status: 404 },
    );
  }
  const email = authUser.user.email;
  if (!email) {
    return NextResponse.json(
      { error: "user has no email on file — set one first so the magic link has a destination" },
      { status: 400 },
    );
  }

  // Build the post-login redirect. Uses the request origin so it works
  // for both the Vercel preview and production domains without guessing.
  const origin = new URL(request.url).origin;

  const { data, error } = await svc.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error || !data?.properties?.action_link) {
    return NextResponse.json(
      { error: `generateLink failed: ${error?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    url: data.properties.action_link,
    email,
    expiresHint: "~1 hour, single use",
  });
}
