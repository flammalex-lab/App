import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/utils/phone";
import { sendSms } from "@/lib/twilio/client";
import { allowedCategoriesFor, allowedGroupsFor } from "@/lib/constants";

interface InviteBody {
  phone: string;
  name: string;
  email?: string | null;
  title?: string | null;
  buyer_type?: string | null;
}

// How many starter items to seed into the default guide. 15 gives enough
// breadth without overwhelming; Alex can trim or expand from the editor.
const STARTER_GUIDE_LIMIT = 15;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }
  const { id: accountId } = await params;
  const body = (await request.json()) as InviteBody;
  const e164 = normalizePhone(body.phone);
  if (!e164) return NextResponse.json({ error: "invalid phone" }, { status: 400 });
  if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const svc = createServiceClient();

  const firstName = body.name.split(" ")[0] ?? "";
  const lastName = body.name.split(" ").slice(1).join(" ");

  const { data: created, error } = await svc.auth.admin.createUser({
    phone: e164,
    phone_confirm: true,
    email: body.email?.trim() || undefined,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      role: "b2b_buyer",
    },
  });
  if (error || !created.user) {
    return NextResponse.json({ error: error?.message ?? "create failed" }, { status: 500 });
  }
  const profileId = created.user.id;

  await svc
    .from("profiles")
    .update({
      account_id: accountId,
      role: "b2b_buyer",
      title: body.title?.trim() || null,
      buyer_type: body.buyer_type || null,
      email: body.email?.trim() || null,
    })
    .eq("id", profileId);

  await svc
    .from("profile_accounts")
    .insert({ profile_id: profileId, account_id: accountId, is_default: true })
    .select()
    .maybeSingle();

  const seeded = await seedStarterGuide(svc, profileId, body.buyer_type ?? null);

  await sendSms({
    to: e164,
    body: `Welcome to Fingerlakes Farms. Sign in at ${process.env.NEXT_PUBLIC_APP_URL}/login — enter this number to receive a code.`,
  });

  return NextResponse.json({ ok: true, profileId, seeded });
}

async function seedStarterGuide(
  svc: ReturnType<typeof createServiceClient>,
  profileId: string,
  buyerType: string | null,
): Promise<number> {
  let { data: guideRow } = await svc
    .from("order_guides")
    .select("id")
    .eq("profile_id", profileId)
    .eq("is_default", true)
    .maybeSingle();
  if (!guideRow) {
    const { data: inserted } = await svc
      .from("order_guides")
      .insert({ profile_id: profileId, name: "My order guide", is_default: true })
      .select("id")
      .single();
    guideRow = inserted;
  }
  if (!guideRow) return 0;

  const allowedGroups = allowedGroupsFor(buyerType);
  const allowedCats = allowedCategoriesFor(buyerType);
  if (allowedGroups.length === 0 && allowedCats.length === 0) return 0;

  // Match on EITHER category OR product_group so we cover both old data
  // (category only) and new data (product_group backfilled by 0006).
  const orExpr = [
    allowedCats.length ? `category.in.(${allowedCats.join(",")})` : null,
    allowedGroups.length ? `product_group.in.(${allowedGroups.join(",")})` : null,
  ]
    .filter(Boolean)
    .join(",");

  // Cascade from strictest filter to most permissive so a sparsely-flagged
  // catalog still yields a seeded guide.
  async function fetchCandidates(stage: 1 | 2 | 3): Promise<{ id: string }[]> {
    let q = svc.from("products").select("id").eq("is_active", true).or(orExpr);
    if (stage <= 2) q = q.eq("available_b2b", true);
    if (stage === 1) q = q.eq("available_this_week", true);
    const { data, error: qErr } = await q
      .order("sort_order", { ascending: true })
      .limit(STARTER_GUIDE_LIMIT);
    if (qErr) console.error(`[invite-buyer] seed stage ${stage} query failed:`, qErr.message);
    return (data as { id: string }[] | null) ?? [];
  }

  let candidates = await fetchCandidates(1);
  if (candidates.length === 0) candidates = await fetchCandidates(2);
  if (candidates.length === 0) candidates = await fetchCandidates(3);
  if (candidates.length === 0) {
    console.warn(
      `[invite-buyer] no candidate products for buyer_type=${buyerType} (categories=${allowedCats.join("|")} groups=${allowedGroups.join("|")})`,
    );
    return 0;
  }

  const rows = candidates.map((p, i) => ({
    order_guide_id: guideRow!.id,
    product_id: p.id,
    sort_order: i,
  }));
  const { error: insertErr } = await svc.from("order_guide_items").insert(rows);
  if (insertErr) {
    console.error("[invite-buyer] seed insert failed:", insertErr.message);
    return 0;
  }
  return rows.length;
}
