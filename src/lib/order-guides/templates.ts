import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrCreateDefaultGuide } from "./default-guide";

interface TemplateItemSrc {
  product_id: string;
  suggested_qty: number | null;
  par_levels: Record<string, number> | null;
  sort_order: number;
}

/**
 * Seed a buyer's default guide from one or more templates. Unions items
 * across templates (keeping the first occurrence's par/qty), dedupes by
 * product_id, and records the template sources in order_guide_seed_sources
 * so future sync-from-template calls know where to look.
 *
 * Respects tombstones in order_guide_item_removals — products the buyer has
 * explicitly removed are never re-added by seeding.
 *
 * Returns the number of items inserted into the buyer's guide.
 */
export async function seedGuideFromTemplates(
  svc: SupabaseClient,
  profileId: string,
  templateIds: string[],
  opts: { replaceExisting?: boolean } = {},
): Promise<number> {
  if (templateIds.length === 0) return 0;
  const guide = await getOrCreateDefaultGuide(svc, profileId);
  if (!guide) return 0;
  const guideId = guide.id;

  if (opts.replaceExisting) {
    await svc.from("order_guide_items").delete().eq("order_guide_id", guideId);
  } else {
    const { count } = await svc
      .from("order_guide_items")
      .select("id", { count: "exact", head: true })
      .eq("order_guide_id", guideId);
    if ((count ?? 0) > 0) {
      // Don't clobber an existing curated guide. Still record the template
      // sources so a later sync can reference them.
      await recordSeedSources(svc, guideId, templateIds);
      return 0;
    }
  }

  const merged = await mergeTemplateItems(svc, templateIds);
  const removed = await fetchRemovalSet(svc, profileId);
  const rows = merged
    .filter((it) => !removed.has(it.product_id))
    .map((it, i) => ({
      order_guide_id: guideId,
      product_id: it.product_id,
      suggested_qty: it.suggested_qty,
      par_levels: it.par_levels,
      sort_order: i,
    }));

  if (rows.length > 0) {
    const { error } = await svc.from("order_guide_items").insert(rows);
    if (error) {
      console.error("[seedGuideFromTemplates] insert failed:", error.message);
      return 0;
    }
  }

  await recordSeedSources(svc, guideId, templateIds);
  return rows.length;
}

/**
 * Add any items in the guide's source templates that aren't already in the
 * guide and aren't tombstoned. Doesn't remove anything, doesn't touch par
 * levels on items the buyer already has. Returns the count added.
 */
export async function syncGuideFromTemplates(
  svc: SupabaseClient,
  profileId: string,
): Promise<number> {
  const guide = await getOrCreateDefaultGuide(svc, profileId);
  if (!guide) return 0;
  const guideId = guide.id;

  const { data: sources } = await svc
    .from("order_guide_seed_sources")
    .select("template_id")
    .eq("guide_id", guideId);
  const templateIds = ((sources as { template_id: string }[] | null) ?? []).map((s) => s.template_id);
  if (templateIds.length === 0) return 0;

  const merged = await mergeTemplateItems(svc, templateIds);

  const { data: existingRaw } = await svc
    .from("order_guide_items")
    .select("product_id")
    .eq("order_guide_id", guideId);
  const existing = new Set(((existingRaw as { product_id: string }[] | null) ?? []).map((r) => r.product_id));

  const removed = await fetchRemovalSet(svc, profileId);

  const toAdd = merged.filter((it) => !existing.has(it.product_id) && !removed.has(it.product_id));
  if (toAdd.length === 0) return 0;

  const { count: baseCount } = await svc
    .from("order_guide_items")
    .select("id", { count: "exact", head: true })
    .eq("order_guide_id", guideId);
  const startSort = (baseCount ?? 0) * 10;

  const rows = toAdd.map((it, i) => ({
    order_guide_id: guideId,
    product_id: it.product_id,
    suggested_qty: it.suggested_qty,
    par_levels: it.par_levels,
    sort_order: startSort + i,
  }));
  const { error } = await svc.from("order_guide_items").insert(rows);
  if (error) {
    console.error("[syncGuideFromTemplates] insert failed:", error.message);
    return 0;
  }
  return rows.length;
}

async function mergeTemplateItems(
  svc: SupabaseClient,
  templateIds: string[],
): Promise<TemplateItemSrc[]> {
  const { data } = await svc
    .from("order_guide_template_items")
    .select("product_id, suggested_qty, par_levels, sort_order, template_id")
    .in("template_id", templateIds)
    .order("sort_order", { ascending: true });
  const seen = new Set<string>();
  const merged: TemplateItemSrc[] = [];
  for (const r of ((data as (TemplateItemSrc & { template_id: string })[] | null) ?? [])) {
    if (seen.has(r.product_id)) continue;
    seen.add(r.product_id);
    merged.push({
      product_id: r.product_id,
      suggested_qty: r.suggested_qty,
      par_levels: r.par_levels,
      sort_order: r.sort_order,
    });
  }
  return merged;
}

async function fetchRemovalSet(svc: SupabaseClient, profileId: string): Promise<Set<string>> {
  const { data } = await svc
    .from("order_guide_item_removals")
    .select("product_id")
    .eq("profile_id", profileId);
  return new Set(((data as { product_id: string }[] | null) ?? []).map((r) => r.product_id));
}

async function recordSeedSources(
  svc: SupabaseClient,
  guideId: string,
  templateIds: string[],
): Promise<void> {
  const rows = templateIds.map((template_id) => ({ guide_id: guideId, template_id }));
  await svc.from("order_guide_seed_sources").upsert(rows, { onConflict: "guide_id,template_id" });
}

/**
 * Drift summary for the Edit Buyer page. Compares the buyer's current
 * guide to the union of their source templates.
 */
export interface GuideDrift {
  addedByBuyer: number;        // in guide, not in any source template
  removedFromTemplates: number; // in any template, tombstoned by buyer
  pendingSync: number;         // in a template, not in guide, not tombstoned
  templateIds: string[];       // the guide's source templates (for the sync button)
}

export async function computeGuideDrift(
  svc: SupabaseClient,
  profileId: string,
  guideId: string,
): Promise<GuideDrift> {
  const { data: sources } = await svc
    .from("order_guide_seed_sources")
    .select("template_id")
    .eq("guide_id", guideId);
  const templateIds = ((sources as { template_id: string }[] | null) ?? []).map((s) => s.template_id);
  if (templateIds.length === 0) {
    return { addedByBuyer: 0, removedFromTemplates: 0, pendingSync: 0, templateIds: [] };
  }

  const [{ data: templateItemsRaw }, { data: guideItemsRaw }, { data: removalsRaw }] = await Promise.all([
    svc
      .from("order_guide_template_items")
      .select("product_id")
      .in("template_id", templateIds),
    svc.from("order_guide_items").select("product_id").eq("order_guide_id", guideId),
    svc.from("order_guide_item_removals").select("product_id").eq("profile_id", profileId),
  ]);
  const templateSet = new Set(((templateItemsRaw as { product_id: string }[] | null) ?? []).map((r) => r.product_id));
  const guideSet = new Set(((guideItemsRaw as { product_id: string }[] | null) ?? []).map((r) => r.product_id));
  const removedSet = new Set(((removalsRaw as { product_id: string }[] | null) ?? []).map((r) => r.product_id));

  let addedByBuyer = 0;
  for (const pid of guideSet) if (!templateSet.has(pid)) addedByBuyer += 1;

  let removedFromTemplates = 0;
  for (const pid of removedSet) if (templateSet.has(pid)) removedFromTemplates += 1;

  let pendingSync = 0;
  for (const pid of templateSet) {
    if (!guideSet.has(pid) && !removedSet.has(pid)) pendingSync += 1;
  }

  return { addedByBuyer, removedFromTemplates, pendingSync, templateIds };
}
