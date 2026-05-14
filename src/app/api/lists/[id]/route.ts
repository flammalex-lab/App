import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";

const MAX_NAME = 60;

/**
 * Resolve the calling buyer's effective profile id and verify the target
 * `order_guides` row both exists and belongs to them. Centralised so
 * PATCH / DELETE / nested item routes share the same auth + ownership
 * guard.
 *
 * Returns either:
 *  - `{ error: NextResponse }` — return that response directly from the route
 *  - `{ profileId, guide }` — caller is authorised; row is loaded
 */
export async function resolveListAccess(
  listId: string,
): Promise<
  | { error: NextResponse }
  | {
      profileId: string;
      guide: { id: string; profile_id: string; name: string; is_default: boolean };
    }
> {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  const impersonating = session.profile.role === "admin" ? await getImpersonation() : null;
  const profileId = impersonating ?? session.userId;

  const svc = createServiceClient();
  const { data, error } = await svc
    .from("order_guides")
    .select("id, profile_id, name, is_default")
    .eq("id", listId)
    .maybeSingle();
  if (error) {
    return { error: NextResponse.json({ error: error.message }, { status: 500 }) };
  }
  if (!data) {
    return { error: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  }
  const guide = data as {
    id: string;
    profile_id: string;
    name: string;
    is_default: boolean;
  };
  if (guide.profile_id !== profileId) {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { profileId, guide };
}

/** Validate the JSON body of a rename request. Exported for unit tests. */
export function validateRenameBody(body: unknown): { ok: true; name: string } | { ok: false; error: string; status: number } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body", status: 400 };
  }
  const raw = (body as { name?: unknown }).name;
  if (typeof raw !== "string") {
    return { ok: false, error: "missing_name", status: 400 };
  }
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "missing_name", status: 400 };
  if (trimmed.length > MAX_NAME) {
    return { ok: false, error: "name_too_long", status: 400 };
  }
  return { ok: true, name: trimmed };
}

/**
 * PATCH /api/lists/[id]
 *
 * Body: { name: string }
 *
 * Renames an order guide. Default lists CAN be renamed (so a buyer can call
 * their "default" list "Mon prep" if that's their primary rhythm). Only
 * the owner (or an admin impersonating them) can rename.
 */
export async function PATCH(
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
  const validated = validateRenameBody(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: validated.status });
  }

  const access = await resolveListAccess(id);
  if ("error" in access) return access.error;

  const svc = createServiceClient();
  const { error: updErr } = await svc
    .from("order_guides")
    .update({ name: validated.name })
    .eq("id", id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }
  return NextResponse.json({ id, name: validated.name });
}

/**
 * DELETE /api/lists/[id]
 *
 * Deletes a non-default order guide. The default list is protected — a
 * buyer can rename it but never delete it. `order_guide_items` rows
 * cascade via the FK; we don't touch tombstones because they're scoped
 * to the buyer's profile, not the deleted list.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await resolveListAccess(id);
  if ("error" in access) return access.error;
  if (access.guide.is_default) {
    return NextResponse.json(
      { error: "cannot_delete_default" },
      { status: 400 },
    );
  }

  const svc = createServiceClient();
  const { error } = await svc.from("order_guides").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
