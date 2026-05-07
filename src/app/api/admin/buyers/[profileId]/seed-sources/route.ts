import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { findDefaultGuide, getOrCreateDefaultGuide } from "@/lib/order-guides/default-guide";
import { seedGuideFromTemplates } from "@/lib/order-guides/templates";

/** Add one or more templates as seed sources for a buyer's default guide. */
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
  const { template_ids, seed_now } = (await request.json()) as {
    template_ids: string[];
    seed_now?: boolean;
  };
  if (!Array.isArray(template_ids) || template_ids.length === 0) {
    return NextResponse.json({ error: "template_ids required" }, { status: 400 });
  }
  const svc = createServiceClient();
  const guide = await getOrCreateDefaultGuide(svc, profileId);
  if (!guide) return NextResponse.json({ error: "couldn't resolve default guide" }, { status: 500 });

  const rows = template_ids.map((template_id) => ({ guide_id: guide.id, template_id }));
  const { error } = await svc
    .from("order_guide_seed_sources")
    .upsert(rows, { onConflict: "guide_id,template_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let seeded = 0;
  if (seed_now) {
    // Seed items from the newly added templates (preserves existing items
    // via the non-replace path; merges in anything missing).
    seeded = await seedGuideFromTemplates(svc, profileId, template_ids);
  }

  return NextResponse.json({ ok: true, seeded });
}

/** Remove a template from a buyer's seed sources. Items stay. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }
  const { profileId } = await params;
  const url = new URL(request.url);
  const templateId = url.searchParams.get("template_id");
  if (!templateId) return NextResponse.json({ error: "template_id required" }, { status: 400 });

  const svc = createServiceClient();
  const guide = await findDefaultGuide(svc, profileId);
  if (!guide) return NextResponse.json({ ok: true }); // nothing to remove

  const { error } = await svc
    .from("order_guide_seed_sources")
    .delete()
    .eq("guide_id", guide.id)
    .eq("template_id", templateId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
