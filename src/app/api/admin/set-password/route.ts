import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Admin-only password setter. Bypasses the email-recovery loop —
 * useful for spinning up tester accounts or fixing a buyer who can't
 * receive recovery email. Calls supabase.auth.admin.updateUserById
 * directly with the service-role key.
 */
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }

  const { profileId, password } = (await request.json()) as {
    profileId?: string;
    password?: string;
  };
  if (!profileId) {
    return NextResponse.json({ error: "profileId required" }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: "password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const svc = createServiceClient();
  // Mark email_confirm so the user can immediately sign in via email +
  // password. Without this, Supabase's default email-confirmation flow
  // would require them to click a verification link first.
  const { error } = await svc.auth.admin.updateUserById(profileId, {
    password,
    email_confirm: true,
  });
  if (error) {
    return NextResponse.json(
      { error: `update failed: ${error.message}` },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
