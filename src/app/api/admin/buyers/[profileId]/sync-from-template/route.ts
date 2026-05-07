import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { syncGuideFromTemplates } from "@/lib/order-guides/templates";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
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
