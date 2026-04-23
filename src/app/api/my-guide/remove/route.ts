import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import { findDefaultGuide } from "@/lib/order-guides/default-guide";

/**
 * Remove a product from the buyer's default guide and record a tombstone
 * so future sync-from-template calls don't re-add it.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const impersonating = session.profile.role === "admin" ? getImpersonation() : null;
  const profileId = impersonating ?? session.userId;

  const { product_id } = (await request.json()) as { product_id: string };
  if (!product_id) return NextResponse.json({ error: "missing product_id" }, { status: 400 });

  const svc = createServiceClient();
  const guide = await findDefaultGuide(svc, profileId);
  if (guide) {
    await svc
      .from("order_guide_items")
      .delete()
      .eq("order_guide_id", guide.id)
      .eq("product_id", product_id);
  }
  await svc
    .from("order_guide_item_removals")
    .upsert({ profile_id: profileId, product_id }, { onConflict: "profile_id,product_id" });

  return NextResponse.json({ ok: true });
}
