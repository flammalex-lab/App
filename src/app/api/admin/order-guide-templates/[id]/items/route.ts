import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";

interface ItemIn {
  product_id: string;
  suggested_qty: number | null;
  par_levels: Record<string, number> | null;
  sort_order: number;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }
  const { id: templateId } = await params;
  const body = (await request.json()) as { items: ItemIn[] };
  const items = Array.isArray(body.items) ? body.items : [];
  const svc = createServiceClient();

  // Replace semantics: wipe existing rows, bulk insert the new ones.
  const del = await svc.from("order_guide_template_items").delete().eq("template_id", templateId);
  if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 });

  if (items.length > 0) {
    const rows = items.map((it, i) => ({
      template_id: templateId,
      product_id: it.product_id,
      suggested_qty: it.suggested_qty,
      par_levels: it.par_levels,
      sort_order: i,
    }));
    const { error } = await svc.from("order_guide_template_items").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Touch the template so updated_at advances (helps "last edited" in the list).
  await svc.from("order_guide_templates").update({ updated_at: new Date().toISOString() }).eq("id", templateId);

  return NextResponse.json({ ok: true, count: items.length });
}
