import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/utils/phone";

interface PatchBody {
  first_name?: string | null;
  last_name?: string | null;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  buyer_type?: string | null;
  notes?: string | null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }
  const { profileId } = await params;
  const body = (await request.json()) as PatchBody;
  const svc = createServiceClient();

  // Normalize phone if supplied; store in profile + auth.users so SMS login works.
  let e164: string | null = null;
  if (body.phone) {
    e164 = normalizePhone(body.phone);
    if (!e164) return NextResponse.json({ error: "invalid phone" }, { status: 400 });
  }

  const profileUpdate: Record<string, unknown> = {
    first_name: body.first_name ?? null,
    last_name: body.last_name ?? null,
    title: body.title ?? null,
    email: body.email ?? null,
    buyer_type: body.buyer_type ?? null,
    notes: body.notes ?? null,
  };
  if (e164) profileUpdate.phone = e164;

  const { error: profileErr } = await svc
    .from("profiles")
    .update(profileUpdate)
    .eq("id", profileId);
  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 });

  // Keep auth.users in sync for phone + email so login keeps working.
  const authUpdate: Record<string, unknown> = {};
  if (e164) authUpdate.phone = e164;
  if (body.email !== undefined) authUpdate.email = body.email || undefined;
  if (Object.keys(authUpdate).length > 0) {
    await svc.auth.admin.updateUserById(profileId, authUpdate);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }
  const { profileId } = await params;
  const svc = createServiceClient();

  // Refuse if this buyer has any orders — FK is on delete restrict and we
  // want to preserve financial history anyway.
  const { count } = await svc
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId);
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "buyer has past orders; cannot delete" },
      { status: 409 },
    );
  }

  // Delete the auth user; profiles + order_guides + order_guide_items
  // cascade on FK. profile_accounts has no cascade defined, so clean up
  // explicitly first to avoid a dangling row.
  await svc.from("profile_accounts").delete().eq("profile_id", profileId);
  const { error } = await svc.auth.admin.deleteUser(profileId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
