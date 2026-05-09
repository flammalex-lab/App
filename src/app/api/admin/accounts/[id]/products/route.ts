import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";

interface Input {
  productIds: string[];
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
  const { id: accountId } = await params;
  const { productIds } = (await request.json()) as Input;
  const svc = createServiceClient();

  // Replace strategy: delete all then reinsert. Mirrors the pricing route so
  // the editor can do whole-table saves without diffing on the client.
  const { error: delErr } = await svc
    .from("account_products")
    .delete()
    .eq("account_id", accountId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  if (productIds.length) {
    const rows = productIds.map((product_id) => ({ account_id: accountId, product_id }));
    const { error: insErr } = await svc.from("account_products").insert(rows);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
