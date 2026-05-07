import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";

interface Input {
  overrides: { product_id: string; custom_price: number }[];
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }
  const { id: accountId } = await params;
  const { overrides } = (await request.json()) as Input;
  const svc = createServiceClient();

  // Replace strategy: delete all then reinsert.
  const { error: delErr } = await svc.from("account_pricing").delete().eq("account_id", accountId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  if (overrides.length) {
    const { error: insErr } = await svc.from("account_pricing").insert(
      overrides.map((o) => ({
        account_id: accountId,
        product_id: o.product_id,
        custom_price: o.custom_price,
      })),
    );
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
