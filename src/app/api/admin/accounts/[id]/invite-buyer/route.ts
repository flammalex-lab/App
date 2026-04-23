import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/utils/phone";
import { sendSms } from "@/lib/twilio/client";
import { allowedGroupsFor } from "@/lib/constants";

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

  // Create the auth user with phone (no password — they'll sign in via OTP).
  // The handle_new_user trigger inserts the profile row, and the
  // ensure_default_order_guide trigger creates their default guide.
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

  // Update profile with account link, title, buyer_type override, email.
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

  // Ensure a profile_accounts row exists for the multi-account path.
  await svc
    .from("profile_accounts")
    .insert({ profile_id: profileId, account_id: accountId, is_default: true })
    .select()
    .maybeSingle();

  // Seed the default guide with starter items matching the buyer's allowed
  // groups. Uses allowedGroupsFor() so the seed matches exactly what the
  // buyer can see on /catalog.
  await seedStarterGuide(svc, profileId, body.buyer_type ?? null);

  // Welcome SMS
  await sendSms({
    to: e164,
    body: `Welcome to Fingerlakes Farms. Sign in at ${process.env.NEXT_PUBLIC_APP_URL}/login — enter this number to receive a code.`,
  });

  return NextResponse.json({ ok: true, profileId });
}

async function seedStarterGuide(
  svc: ReturnType<typeof createServiceClient>,
  profileId: string,
  buyerType: string | null,
): Promise<void> {
  // Fetch (or ensure) the default guide. The ensure_default_order_guide
  // trigger should have created it already, but handle the race just in case.
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
  if (!guideRow) return;

  const allowed = allowedGroupsFor(buyerType);
  if (allowed.length === 0) return;

  // Pick starter items: currently-available, B2B-enabled products in the
  // buyer's groups, ordered by sort_order (same signal the catalog uses
  // for "Best sellers").
  const { data: products } = await svc
    .from("products")
    .select("id")
    .eq("is_active", true)
    .eq("available_b2b", true)
    .eq("available_this_week", true)
    .in("product_group", allowed)
    .order("sort_order", { ascending: true })
    .limit(STARTER_GUIDE_LIMIT);

  const rows = (products ?? []).map((p, i) => ({
    order_guide_id: guideRow!.id,
    product_id: p.id,
    sort_order: i,
  }));
  if (rows.length === 0) return;

  await svc.from("order_guide_items").insert(rows);
}
