import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import { getOrCreateDefaultGuide } from "@/lib/order-guides/default-guide";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const impersonating = session.profile.role === "admin" ? getImpersonation() : null;
  const profileId = impersonating ?? session.userId;

  const { product_id } = (await request.json()) as { product_id: string };
  if (!product_id) return NextResponse.json({ error: "missing product_id" }, { status: 400 });

  const svc = createServiceClient();

  const guide = await getOrCreateDefaultGuide(svc, profileId);
  if (!guide) return NextResponse.json({ error: "couldn't resolve default guide" }, { status: 500 });

  // Bail if already in the guide (unique constraint on order_guide_id+product_id).
  const { data: existing } = await svc
    .from("order_guide_items")
    .select("id")
    .eq("order_guide_id", guide.id)
    .eq("product_id", product_id)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true, alreadyExisted: true, guideId: guide.id });

  const { count } = await svc
    .from("order_guide_items")
    .select("id", { count: "exact", head: true })
    .eq("order_guide_id", guide.id);

  const { error: insErr } = await svc.from("order_guide_items").insert({
    order_guide_id: guide.id,
    product_id,
    sort_order: (count ?? 0) * 10,
  });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, guideId: guide.id });
}
