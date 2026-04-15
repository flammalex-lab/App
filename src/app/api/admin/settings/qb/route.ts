import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try { await requireAdmin(); } catch { return NextResponse.json({ error: "admin only" }, { status: 403 }); }
  const { settings } = (await request.json()) as { settings: Record<string, string> };
  const svc = createServiceClient();
  for (const [key, value] of Object.entries(settings)) {
    await svc.from("qb_settings").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  }
  return NextResponse.json({ ok: true });
}
