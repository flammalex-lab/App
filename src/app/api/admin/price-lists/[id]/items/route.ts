import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { requireSameOrigin } from "@/lib/auth/same-origin";

interface InputItem {
  product_id: string;
  unit_price: number;
  effective_date?: string;
  expiry_date?: string | null;
}

interface Input {
  items: InputItem[];
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
  const { id: listId } = await params;
  const { items } = (await request.json()) as Input;
  const svc = createServiceClient();

  // Replace strategy: delete then reinsert. Same shape as account_pricing
  // so the editor can do whole-table saves without diffing on the client.
  const { error: delErr } = await svc
    .from("price_list_items")
    .delete()
    .eq("price_list_id", listId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  if (items.length) {
    const rows = items.map((it) => ({
      price_list_id: listId,
      product_id: it.product_id,
      unit_price: it.unit_price,
      effective_date: it.effective_date ?? new Date().toISOString().slice(0, 10),
      expiry_date: it.expiry_date ?? null,
    }));
    const { error: insErr } = await svc.from("price_list_items").insert(rows);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
