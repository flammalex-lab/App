import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";

const MAX_NAME = 60;
// Reasonable v1 ceiling. Way more than any restaurant should ever need, but
// stops a runaway client from spamming "New list" rows.
const MAX_LISTS_PER_BUYER = 20;

/**
 * Create a new (non-default) order guide for the calling buyer.
 *
 * Body: { name: string }
 * Returns: { id: string }
 *
 * Default-list creation is auto-managed by the `ensure_default_order_guide`
 * trigger on profile insert (see migration 0001), so this route only ever
 * creates `is_default=false` rows. The unique partial index
 * `order_guides_one_default_per_profile` (migration 0010) prevents anyone
 * from sneaking is_default=true through the API.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const impersonating = session.profile.role === "admin" ? await getImpersonation() : null;
  const profileId = impersonating ?? session.userId;

  let body: { name?: unknown };
  try {
    body = (await request.json()) as { name?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const rawName = typeof body.name === "string" ? body.name.trim() : "";
  if (!rawName) {
    return NextResponse.json({ error: "missing_name" }, { status: 400 });
  }
  if (rawName.length > MAX_NAME) {
    return NextResponse.json({ error: "name_too_long", max: MAX_NAME }, { status: 400 });
  }

  const svc = createServiceClient();

  // Cap: don't let a buyer accumulate hundreds of empty lists.
  const { count } = await svc
    .from("order_guides")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId);
  if ((count ?? 0) >= MAX_LISTS_PER_BUYER) {
    return NextResponse.json(
      { error: "too_many_lists", limit: MAX_LISTS_PER_BUYER },
      { status: 400 },
    );
  }

  const { data, error } = await svc
    .from("order_guides")
    .insert({ profile_id: profileId, name: rawName, is_default: false })
    .select("id, name")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "insert_failed" }, { status: 500 });
  }
  return NextResponse.json({ id: data.id, name: data.name });
}
