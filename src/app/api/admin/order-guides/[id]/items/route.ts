import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";

interface ItemInput {
  product_id: string;
  suggested_qty: number | null;
  par_levels: Record<string, number> | null;
  sort_order: number;
}

/**
 * Replace the items in a guide. Simple strategy: delete + insert in a single
 * transaction-ish flow. If this turns out to be hot enough to need diff-update,
 * revisit.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }
  const { id: guideId } = await params;
  const { items } = (await request.json()) as { items: ItemInput[] };

  const svc = createServiceClient();
  const { error: delErr } = await svc.from("order_guide_items").delete().eq("order_guide_id", guideId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  if (items.length) {
    const { error: insErr } = await svc.from("order_guide_items").insert(
      items.map((i) => ({
        order_guide_id: guideId,
        product_id: i.product_id,
        suggested_qty: i.suggested_qty,
        par_levels: i.par_levels,
        sort_order: i.sort_order,
      })),
    );
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
