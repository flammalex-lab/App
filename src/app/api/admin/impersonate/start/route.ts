import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { setImpersonation } from "@/lib/auth/impersonation";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Anti-CSRF: only accept POSTs whose Origin (or, for old browsers,
 * Referer) is the request's own host. Combined with sameSite=lax/strict
 * cookies (Supabase + the impersonation cookie itself), this blocks an
 * attacker site from triggering an admin's browser to POST here even
 * though the admin session is valid.
 */
function originOk(request: Request): boolean {
  const reqUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === reqUrl.host;
    } catch {
      return false;
    }
  }
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === reqUrl.host;
    } catch {
      return false;
    }
  }
  // No Origin and no Referer is suspicious for a POST that mutates state.
  return false;
}

export async function POST(request: Request) {
  if (!originOk(request)) {
    return NextResponse.json({ error: "cross-origin request rejected" }, { status: 403 });
  }

  let admin;
  try { admin = await requireAdmin(); } catch { return NextResponse.json({ error: "admin only" }, { status: 403 }); }

  const profileId = new URL(request.url).searchParams.get("profileId");
  if (!profileId || !UUID_RE.test(profileId)) {
    return NextResponse.json({ error: "invalid profileId" }, { status: 400 });
  }

  // Validate the target profile exists and is *not* itself an admin —
  // impersonating another admin would let a hijacked admin session pivot
  // through any role escalation that admin holds. .maybeSingle() lets us
  // distinguish DB errors (network blip, RLS misconfig → 500) from a
  // genuinely missing id (404), instead of conflating both as "not found".
  const svc = createServiceClient();
  const { data: target, error: targetErr } = await svc
    .from("profiles")
    .select("id, role")
    .eq("id", profileId)
    .maybeSingle();
  if (targetErr) {
    return NextResponse.json({ error: `profile lookup failed: ${targetErr.message}` }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json({ error: "profile not found" }, { status: 404 });
  }
  if ((target as { role: string }).role === "admin") {
    return NextResponse.json({ error: "cannot impersonate another admin" }, { status: 403 });
  }

  // The audit log is a hard requirement — refuse to set the cookie if
  // we can't record the impersonation. Otherwise a DB hiccup would leave
  // an admin actively impersonating a buyer with no trail.
  const { data: logRow, error: logErr } = await svc
    .from("admin_impersonation_log")
    .insert({
      admin_profile_id: admin.userId,
      target_profile_id: profileId,
      reason: "admin-initiated",
    })
    .select("id")
    .single();
  if (logErr || !logRow) {
    return NextResponse.json(
      { error: `audit log failed: ${logErr?.message ?? "no row"}` },
      { status: 500 },
    );
  }

  // Cookie set is the last step. setImpersonation() rarely throws — Next's
  // cookies().set(...) just queues a Set-Cookie header — but if it does
  // (cookie store called outside a request context, env error in
  // signImpersonationToken, etc.), best-effort rollback the audit log
  // entry so the trail isn't permanently misleading. Best-effort because
  // the rollback DELETE itself can fail (DB blip), in which case we log
  // and accept the orphan rather than 500-loop.
  try {
    await setImpersonation(profileId);
  } catch (e) {
    const { error: rollbackErr } = await svc
      .from("admin_impersonation_log")
      .delete()
      .eq("id", (logRow as { id: string }).id);
    if (rollbackErr) {
      console.error(
        "[impersonate] cookie write failed AND audit-log rollback failed — leaving orphan log row",
        { logId: (logRow as { id: string }).id, rollbackErr: rollbackErr.message },
      );
    }
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: `impersonation cookie write failed: ${msg}` }, { status: 500 });
  }
  return NextResponse.redirect(new URL("/guide", request.url), { status: 303 });
}
