import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { requireSameOrigin } from "@/lib/auth/same-origin";

interface Input {
  name: string;
  description?: string | null;
  active?: boolean;
}

export async function POST(request: Request) {
  const originGate = requireSameOrigin(request);
  if (originGate) return originGate;
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }
  const body = (await request.json()) as Input;
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("price_lists")
    .insert({
      name: body.name.trim(),
      description: body.description ?? null,
      active: body.active ?? true,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: (data as { id: string }).id });
}
