import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { getImpersonation, setImpersonation } from "@/lib/auth/impersonation";

export async function POST(request: Request) {
  let admin;
  try { admin = await requireAdmin(); } catch { return NextResponse.json({ error: "admin only" }, { status: 403 }); }
  const target = getImpersonation();
  if (target) {
    const svc = createServiceClient();
    await svc
      .from("admin_impersonation_log")
      .update({ ended_at: new Date().toISOString() })
      .eq("admin_profile_id", admin.userId)
      .eq("target_profile_id", target)
      .is("ended_at", null);
  }
  await setImpersonation(null);
  return NextResponse.redirect(new URL("/dashboard", request.url), { status: 303 });
}
