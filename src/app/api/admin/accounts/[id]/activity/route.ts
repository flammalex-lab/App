import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import type { ActivityType } from "@/lib/supabase/types";

interface Body {
  type: ActivityType;
  subject: string;
  body: string | null;
  follow_up_date: string | null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }
  const { id: accountId } = await params;
  const body = (await request.json()) as Body;
  const svc = createServiceClient();
  const { error } = await svc.from("activities").insert({
    account_id: accountId,
    profile_id: admin.userId,
    type: body.type,
    subject: body.subject,
    body: body.body,
    follow_up_date: body.follow_up_date,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
