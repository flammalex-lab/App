import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const impersonating = session.profile.role === "admin" ? getImpersonation() : null;
  const profileId = impersonating ?? session.userId;

  const { product_id } = (await request.json()) as { product_id: string };
  if (!product_id) return NextResponse.json({ error: "missing product_id" }, { status: 400 });

  const svc = createServiceClient();

  // Ensure a default guide exists for the buyer
  const { data: existingGuide } = await svc
    .from("order_guides")
    .select("id")
    .eq("profile_id", profileId)
    .eq("is_default", true)
    .maybeSingle();

  let guideId = (existingGuide as any)?.id as string | undefined;
  if (!guideId) {
    const { data: created, error: createErr } = await svc
      .from("order_guides")
      .insert({ profile_id: profileId, name: "My order guide", is_default: true })
      .select("id")
      .single();
    if (createErr || !created) return NextResponse.json({ error: createErr?.message ?? "guide create failed" }, { status: 500 });
    guideId = (created as any).id as string;
  }

  // Check for an existing entry before insert (unique constraint)
  const { data: existing } = await svc
    .from("order_guide_items")
    .select("id")
    .eq("order_guide_id", guideId)
    .eq("product_id", product_id)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true, alreadyExisted: true });

  // Append at the end
  const { data: countRow } = await svc
    .from("order_guide_items")
    .select("id", { count: "exact", head: true })
    .eq("order_guide_id", guideId);
  const count = (countRow as any)?.count ?? 0;

  const { error: insErr } = await svc.from("order_guide_items").insert({
    order_guide_id: guideId,
    product_id,
    sort_order: count * 10,
  });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
