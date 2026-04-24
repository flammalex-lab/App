import type { createServiceClient } from "@/lib/supabase/server";
import { allowedCategoriesFor, allowedGroupsFor } from "@/lib/constants";
import { getOrCreateDefaultGuide } from "@/lib/order-guides/default-guide";

const STARTER_GUIDE_LIMIT = 15;

/**
 * Populate a buyer's default guide with starter items matching their
 * buyer_type. Shared by the invite-buyer flow (on creation) and the
 * re-seed button on the Edit Buyer page (for existing empty guides).
 *
 * Returns the count of items inserted. Safe to call with `replaceExisting=false`
 * to avoid clobbering a curated guide.
 */
export async function seedStarterGuide(
  svc: ReturnType<typeof createServiceClient>,
  profileId: string,
  buyerType: string | null,
  opts: { replaceExisting?: boolean } = {},
): Promise<number> {
  const guide = await getOrCreateDefaultGuide(svc, profileId);
  if (!guide) return 0;
  const guideId = guide.id;

  // Don't wipe a curated guide unless asked.
  if (!opts.replaceExisting) {
    const { count } = await svc
      .from("order_guide_items")
      .select("id", { count: "exact", head: true })
      .eq("order_guide_id", guideId);
    if ((count ?? 0) > 0) return 0;
  } else {
    await svc.from("order_guide_items").delete().eq("order_guide_id", guideId);
  }

  const allowedGroups = allowedGroupsFor(buyerType);
  const allowedCats = allowedCategoriesFor(buyerType);
  if (allowedGroups.length === 0 && allowedCats.length === 0) return 0;

  // Match on EITHER category OR product_group so old and new data both work.
  const orExpr = [
    allowedCats.length ? `category.in.(${allowedCats.join(",")})` : null,
    allowedGroups.length ? `product_group.in.(${allowedGroups.join(",")})` : null,
  ]
    .filter(Boolean)
    .join(",");

  // Two-stage fallback: prefer in-this-week picks, then drop the weekly flag
  // if nothing matches. We deliberately never drop available_b2b — a seeded
  // guide item that isn't live for B2B would silently vanish from the buyer's
  // /guide page at read time.
  async function fetchCandidates(stage: 1 | 2): Promise<{ id: string }[]> {
    let q = svc
      .from("products")
      .select("id")
      .eq("is_active", true)
      .eq("available_b2b", true)
      .or(orExpr);
    if (stage === 1) q = q.eq("available_this_week", true);
    const { data, error: qErr } = await q
      .order("sort_order", { ascending: true })
      .limit(STARTER_GUIDE_LIMIT);
    if (qErr) console.error(`[seedStarterGuide] stage ${stage} query failed:`, qErr.message);
    return (data as { id: string }[] | null) ?? [];
  }

  let candidates = await fetchCandidates(1);
  if (candidates.length === 0) candidates = await fetchCandidates(2);
  if (candidates.length === 0) {
    console.warn(
      `[seedStarterGuide] no candidates for buyer_type=${buyerType} (cats=${allowedCats.join("|")} groups=${allowedGroups.join("|")})`,
    );
    return 0;
  }

  const rows = candidates.map((p, i) => ({
    order_guide_id: guideId,
    product_id: p.id,
    sort_order: i,
  }));
  const { error: insertErr } = await svc.from("order_guide_items").insert(rows);
  if (insertErr) {
    console.error("[seedStarterGuide] insert failed:", insertErr.message);
    return 0;
  }
  return rows.length;
}
