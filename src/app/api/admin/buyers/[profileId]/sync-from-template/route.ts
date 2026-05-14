import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { syncGuideFromTemplates } from "@/lib/order-guides/templates";
import { requireSameOrigin } from "@/lib/auth/same-origin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  const originGate = requireSameOrigin(request);
  if (originGate) return originGate;
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }
  const { profileId } = await params;
  const svc = createServiceClient();
  const added = await syncGuideFromTemplates(svc, profileId);
  return NextResponse.json({ ok: true, added });
}
