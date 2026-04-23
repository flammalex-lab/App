import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";

interface PatchBody {
  name?: string;
  buyer_type?: string | null;
  description?: string | null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }
  const { id } = await params;
  const body = (await request.json()) as PatchBody;
  const svc = createServiceClient();
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) {
    if (!body.name.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
    patch.name = body.name.trim();
  }
  if (body.buyer_type !== undefined) patch.buyer_type = body.buyer_type || null;
  if (body.description !== undefined) patch.description = body.description?.trim() || null;

  const { error } = await svc.from("order_guide_templates").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }
  const { id } = await params;
  const svc = createServiceClient();
  // order_guide_template_items + order_guide_seed_sources cascade on FK.
  // Existing buyer guides that came from this template keep their items —
  // we just lose the lineage (seed_sources rows cascade away).
  const { error } = await svc.from("order_guide_templates").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
