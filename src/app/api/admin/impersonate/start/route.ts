import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { setImpersonation } from "@/lib/auth/impersonation";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let admin;
  try { admin = await requireAdmin(); } catch { return NextResponse.json({ error: "admin only" }, { status: 403 }); }

  const profileId = new URL(request.url).searchParams.get("profileId");
  if (!profileId || !UUID_RE.test(profileId)) {
    return NextResponse.json({ error: "invalid profileId" }, { status: 400 });
  }

  // Validate the target profile exists and is *not* itself an admin —
  // impersonating another admin would let a hijacked admin session pivot
  // through any role escalation that admin holds.
  const svc = createServiceClient();
  const { data: target } = await svc
    .from("profiles")
    .select("id, role")
    .eq("id", profileId)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: "profile not found" }, { status: 404 });
  if ((target as { role: string }).role === "admin") {
    return NextResponse.json({ error: "cannot impersonate another admin" }, { status: 403 });
  }

  // The audit log is a hard requirement — refuse to set the cookie if
  // we can't record the impersonation. Otherwise a DB hiccup would leave
  // an admin actively impersonating a buyer with no trail.
  const { error: logErr } = await svc.from("admin_impersonation_log").insert({
    admin_profile_id: admin.userId,
    target_profile_id: profileId,
    reason: "admin-initiated",
  });
  if (logErr) {
    return NextResponse.json(
      { error: `audit log failed: ${logErr.message}` },
      { status: 500 },
    );
  }

  await setImpersonation(profileId);
  return NextResponse.redirect(new URL("/guide", request.url), { status: 303 });
}
