import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }
  const body = (await request.json()) as {
    name?: string;
    buyer_type?: string | null;
    description?: string | null;
  };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("order_guide_templates")
    .insert({
      name: body.name.trim(),
      buyer_type: body.buyer_type ?? null,
      description: body.description?.trim() || null,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: (data as { id: string }).id });
}
