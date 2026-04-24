import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";

/** Lightweight accounts list used by the Quick Add Buyer dialog. */
export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 500), 1000);
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("accounts")
    .select("id, name, buyer_type")
    .order("name", { ascending: true })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ accounts: data ?? [] });
}
