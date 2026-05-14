import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { getImpersonation, setImpersonation } from "@/lib/auth/impersonation";
import { requireSameOrigin } from "@/lib/auth/same-origin";

export async function POST(request: Request) {
  const originGate = requireSameOrigin(request);
  if (originGate) return originGate;
  let admin;
  try { admin = await requireAdmin(); } catch { return NextResponse.json({ error: "admin only" }, { status: 403 }); }
  const target = await getImpersonation();
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
