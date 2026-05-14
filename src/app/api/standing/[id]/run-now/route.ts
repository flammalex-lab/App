import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { runStandingOrder } from "@/lib/standing-orders/run";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const svc = createServiceClient();
  const { data } = await svc.from("standing_orders").select("profile_id").eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  const row = data as { profile_id: string };
  if (row.profile_id !== session.userId && session.profile.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const result = await runStandingOrder(svc, id);
  const redirectUrl = new URL("/standing", request.url);
  if (!result.ok) {
    // Pass the failure reason through the redirect so the standing-orders
    // page can surface it instead of pretending the run succeeded.
    redirectUrl.searchParams.set("error", "run_failed");
    redirectUrl.searchParams.set("reason", result.error.slice(0, 200));
  }
  return NextResponse.redirect(redirectUrl, { status: 303 });
}
