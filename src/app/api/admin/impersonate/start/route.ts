import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { setImpersonation } from "@/lib/auth/impersonation";

export async function POST(request: Request) {
  let admin;
  try { admin = await requireAdmin(); } catch { return NextResponse.json({ error: "admin only" }, { status: 403 }); }
  const profileId = new URL(request.url).searchParams.get("profileId");
  if (!profileId) return NextResponse.json({ error: "missing profileId" }, { status: 400 });

  const svc = createServiceClient();
  await svc.from("admin_impersonation_log").insert({
    admin_profile_id: admin.userId,
    target_profile_id: profileId,
    reason: "admin-initiated",
  });

  await setImpersonation(profileId);
  return NextResponse.redirect(new URL("/guide", request.url), { status: 303 });
}
