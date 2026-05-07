import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import { computeNextRun } from "@/lib/utils/standing-order";
import type { StandingFreq } from "@/lib/supabase/types";

interface ItemInput {
  product_id: string;
  quantity: number;
  notes: string | null;
}

interface Body {
  name: string;
  frequency: StandingFreq;
  days_of_week: string[];
  require_confirmation: boolean;
  active: boolean;
  items: ItemInput[];
  account_id: string | null;  // admin-only
  profile_id: string | null;  // admin-only
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await request.json()) as Body;
  const svc = createServiceClient();

  // Resolve who this standing order belongs to
  const isAdmin = session.profile.role === "admin";
  const impersonating = isAdmin ? getImpersonation() : null;
  let profileId = isAdmin ? (body.profile_id ?? impersonating ?? null) : session.userId;
  let accountId = isAdmin ? (body.account_id ?? null) : session.profile.account_id;
  if (!profileId || !accountId) {
    // Fallback: look up account via buyer profile
    if (profileId) {
      const { data: p } = await svc.from("profiles").select("account_id").eq("id", profileId).maybeSingle();
      accountId = accountId ?? (p as any)?.account_id ?? null;
    }
  }
  if (!profileId || !accountId) return NextResponse.json({ error: "profile/account required" }, { status: 400 });

  const nextRun = computeNextRun(
    {
      active: body.active,
      days_of_week: body.days_of_week,
      frequency: body.frequency,
      last_run_date: null,
      pause_until: null,
    },
    new Date(),
  );

  const payload = {
    account_id: accountId,
    profile_id: profileId,
    name: body.name || null,
    frequency: body.frequency,
    days_of_week: body.days_of_week,
    require_confirmation: body.require_confirmation,
    active: body.active,
    next_run_date: nextRun ? nextRun.toISOString().slice(0, 10) : null,
  };

  let soId = id;
  if (id === "new") {
    const { data, error } = await svc.from("standing_orders").insert(payload).select("id").single();
    if (error || !data) return NextResponse.json({ error: error?.message ?? "create failed" }, { status: 500 });
    soId = (data as any).id as string;
  } else {
    // Authorize
    const { data: existing } = await svc.from("standing_orders").select("profile_id").eq("id", id).maybeSingle();
    if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
    if ((existing as any).profile_id !== session.userId && !isAdmin) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const { error } = await svc.from("standing_orders").update(payload).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Replace items
  await svc.from("standing_order_items").delete().eq("standing_order_id", soId);
  if (body.items.length) {
    const { error: insErr } = await svc.from("standing_order_items").insert(
      body.items.map((i) => ({
        standing_order_id: soId,
        product_id: i.product_id,
        quantity: i.quantity,
        notes: i.notes,
      })),
    );
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: soId });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const svc = createServiceClient();
  const { data } = await svc.from("standing_orders").select("profile_id").eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  if ((data as any).profile_id !== session.userId && session.profile.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await svc.from("standing_orders").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
