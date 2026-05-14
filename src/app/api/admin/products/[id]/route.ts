import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { CATALOG_SUGGESTIONS_TAG } from "@/lib/products/suggestions";
import { requireSameOrigin } from "@/lib/auth/same-origin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originGate = requireSameOrigin(request);
  if (originGate) return originGate;
  try { await requireAdmin(); } catch { return NextResponse.json({ error: "admin only" }, { status: 403 }); }
  const { id } = await params;
  const body = await request.json();
  const svc = createServiceClient();
  if (id === "new") {
    const { data, error } = await svc.from("products").insert(body).select("id").single();
    if (error || !data) return NextResponse.json({ error: error?.message ?? "no row" }, { status: 500 });
    revalidateTag(CATALOG_SUGGESTIONS_TAG, "max");
    return NextResponse.json({ id: (data as { id: string }).id });
  }
  const { error } = await svc.from("products").update(body).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidateTag(CATALOG_SUGGESTIONS_TAG, "max");
  return NextResponse.json({ id });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originGate = requireSameOrigin(request);
  if (originGate) return originGate;
  try { await requireAdmin(); } catch { return NextResponse.json({ error: "admin only" }, { status: 403 }); }
  const { id } = await params;
  const svc = createServiceClient();
  // Soft delete via is_active to preserve order history FKs.
  const { error } = await svc.from("products").update({ is_active: false }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidateTag(CATALOG_SUGGESTIONS_TAG, "max");
  return NextResponse.json({ ok: true });
}
