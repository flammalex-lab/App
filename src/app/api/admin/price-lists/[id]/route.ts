import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { requireSameOrigin } from "@/lib/auth/same-origin";
import type { TablesUpdate } from "@/lib/supabase/database.types";

interface Input {
  name?: string;
  description?: string | null;
  active?: boolean;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originGate = requireSameOrigin(request);
  if (originGate) return originGate;
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }
  const { id } = await params;
  const body = (await request.json()) as Input;
  const update: TablesUpdate<"price_lists"> = {};
  if (typeof body.name === "string") {
    if (!body.name.trim()) {
      return NextResponse.json({ error: "name cannot be blank" }, { status: 400 });
    }
    update.name = body.name.trim();
  }
  if (body.description !== undefined) update.description = body.description;
  if (typeof body.active === "boolean") update.active = body.active;

  const svc = createServiceClient();
  const { error } = await svc.from("price_lists").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originGate = requireSameOrigin(request);
  if (originGate) return originGate;
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }
  const { id } = await params;
  const svc = createServiceClient();
  const { error } = await svc.from("price_lists").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
