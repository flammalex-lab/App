import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { seedStarterGuide } from "@/lib/order-guides/seed";

interface Body {
  replace?: boolean;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }
  const { profileId } = await params;
  const body = ((await request.json().catch(() => ({}))) as Body) ?? {};
  const svc = createServiceClient();

  const { data: profile } = await svc
    .from("profiles")
    .select("buyer_type, account_id")
    .eq("id", profileId)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "profile not found" }, { status: 404 });

  let buyerType = (profile as any).buyer_type as string | null;
  if (!buyerType && (profile as any).account_id) {
    const { data: acc } = await svc
      .from("accounts")
      .select("buyer_type")
      .eq("id", (profile as any).account_id)
      .maybeSingle();
    buyerType = ((acc as any)?.buyer_type as string | null) ?? null;
  }

  const seeded = await seedStarterGuide(svc, profileId, buyerType, {
    replaceExisting: Boolean(body.replace),
  });

  return NextResponse.json({ ok: true, seeded });
}
