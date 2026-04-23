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
    seed_from_template_id?: string | null;
  };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const svc = createServiceClient();

  const { data: created, error } = await svc
    .from("order_guide_templates")
    .insert({
      name: body.name.trim(),
      buyer_type: body.buyer_type ?? null,
      description: body.description?.trim() || null,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const newId = (created as { id: string }).id;

  // Optional clone: copy every template_item from the source template.
  let seededCount = 0;
  if (body.seed_from_template_id) {
    const { data: sourceItems } = await svc
      .from("order_guide_template_items")
      .select("product_id, suggested_qty, par_levels, sort_order")
      .eq("template_id", body.seed_from_template_id)
      .order("sort_order", { ascending: true });
    const rows = ((sourceItems as { product_id: string; suggested_qty: number | null; par_levels: Record<string, number> | null; sort_order: number }[] | null) ?? []).map((r, i) => ({
      template_id: newId,
      product_id: r.product_id,
      suggested_qty: r.suggested_qty,
      par_levels: r.par_levels,
      sort_order: i,
    }));
    if (rows.length > 0) {
      const { error: copyErr } = await svc.from("order_guide_template_items").insert(rows);
      if (copyErr) {
        console.error("[templates] clone failed:", copyErr.message);
      } else {
        seededCount = rows.length;
      }
    }
  }

  return NextResponse.json({ ok: true, id: newId, seeded: seededCount });
}
