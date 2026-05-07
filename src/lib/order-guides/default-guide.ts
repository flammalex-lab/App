import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Return the buyer's default order guide, creating one if none exists.
 *
 * Robust to legacy rows with multiple defaults per profile: never uses
 * .maybeSingle() (which errors on >1 match), instead takes the oldest.
 * Also handles the race where two concurrent callers both try to create a
 * default — if the unique partial index blocks our insert, we re-query.
 */
export async function getOrCreateDefaultGuide(
  svc: SupabaseClient,
  profileId: string,
): Promise<{ id: string } | null> {
  const existing = await findDefaultGuide(svc, profileId);
  if (existing) return existing;

  const { data: created, error } = await svc
    .from("order_guides")
    .insert({ profile_id: profileId, name: "My order guide", is_default: true })
    .select("id")
    .single();
  if (created) return { id: (created as { id: string }).id };

  // Insert may fail because of the unique index if another request just
  // created the default — re-query and use that.
  if (error) {
    const retry = await findDefaultGuide(svc, profileId);
    if (retry) return retry;
    console.error("[order-guides] getOrCreateDefaultGuide insert failed:", error.message);
  }
  return null;
}

export async function findDefaultGuide(
  svc: SupabaseClient,
  profileId: string,
): Promise<{ id: string } | null> {
  const { data } = await svc
    .from("order_guides")
    .select("id")
    .eq("profile_id", profileId)
    .eq("is_default", true)
    .order("created_at", { ascending: true })
    .limit(1);
  const rows = (data as { id: string }[] | null) ?? [];
  return rows[0] ?? null;
}
