import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveListAccess } from "../route";

/** Validate the body of an add-to-list request. Exported for unit tests. */
export function validateAddItemBody(
  body: unknown,
): { ok: true; productId: string } | { ok: false; error: string; status: number } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body", status: 400 };
  }
  const raw = (body as { product_id?: unknown }).product_id;
  if (typeof raw !== "string" || !raw) {
    return { ok: false, error: "missing_product_id", status: 400 };
  }
  // Loose UUID/text sanity check — same shape as Supabase row ids. We
  // don't enforce strict v4 because product_ids elsewhere are treated
  // as opaque strings; a too-strict check would diverge from /api/my-guide.
  if (raw.length > 64) {
    return { ok: false, error: "invalid_product_id", status: 400 };
  }
  return { ok: true, productId: raw };
}

/**
 * POST /api/lists/[id]/items
 *
 * Body: { product_id: string }
 *
 * Add a product to a SPECIFIC order guide owned by the calling buyer.
 *
 * Important differences from `/api/my-guide/add`:
 *  - Targets the list identified by `[id]`, not the buyer's default guide.
 *  - Does NOT clear `order_guide_item_removals` tombstones. Those tombstones
 *    are profile-scoped and exist to prevent the template-sync flow from
 *    re-adding products to the DEFAULT list. Touching them from a
 *    non-default list would let a Monday-list add resurrect a product the
 *    buyer explicitly removed from their primary rhythm list — confusing.
 *    If the buyer wants this product back on the default list they should
 *    add it there directly (which clears the tombstone).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const validated = validateAddItemBody(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: validated.status });
  }

  const access = await resolveListAccess(id);
  if ("error" in access) return access.error;

  const svc = createServiceClient();

  // Bail if already in this list (unique constraint on guide+product).
  const { data: existing } = await svc
    .from("order_guide_items")
    .select("id")
    .eq("order_guide_id", id)
    .eq("product_id", validated.productId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, alreadyExisted: true });
  }

  const { count } = await svc
    .from("order_guide_items")
    .select("id", { count: "exact", head: true })
    .eq("order_guide_id", id);

  const { error: insErr } = await svc.from("order_guide_items").insert({
    order_guide_id: id,
    product_id: validated.productId,
    sort_order: (count ?? 0) * 10,
  });
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
