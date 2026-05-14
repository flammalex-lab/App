import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveListAccess } from "../../route";

/**
 * DELETE /api/lists/[id]/items/[productId]
 *
 * Remove a product from a SPECIFIC order guide.
 *
 * Symmetric with POST: does NOT write a tombstone in
 * `order_guide_item_removals`. Tombstones are profile-scoped and only
 * meaningful for the default list (they keep the template-sync flow from
 * re-adding the product). Removing from a non-default list is just a row
 * delete — the same product can still live in other lists.
 *
 * If the buyer wants the tombstone behavior they should use
 * `/api/my-guide/remove`, which operates on the default list.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; productId: string }> },
) {
  const { id, productId } = await params;
  if (!productId) {
    return NextResponse.json({ error: "missing_product_id" }, { status: 400 });
  }

  const access = await resolveListAccess(id);
  if ("error" in access) return access.error;

  const svc = createServiceClient();
  const { error } = await svc
    .from("order_guide_items")
    .delete()
    .eq("order_guide_id", id)
    .eq("product_id", productId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
