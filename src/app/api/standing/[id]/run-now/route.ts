import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { runStandingOrder } from "@/lib/standing-orders/run";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const svc = createServiceClient();
  const { data } = await svc.from("standing_orders").select("*").eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  if ((data as any).profile_id !== session.userId && session.profile.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await runStandingOrder(svc, id);
  return NextResponse.redirect(new URL("/standing", request.url), { status: 303 });
}
