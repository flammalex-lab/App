import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";

/** Lightweight template list + item counts for the Add Buyer pickers. */
export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }
  const svc = createServiceClient();
  const [{ data: templatesRaw }, { data: itemCountsRaw }] = await Promise.all([
    svc.from("order_guide_templates").select("id, name, buyer_type").order("name"),
    svc.from("order_guide_template_items").select("template_id"),
  ]);
  const counts = new Map<string, number>();
  for (const r of ((itemCountsRaw as { template_id: string }[] | null) ?? [])) {
    counts.set(r.template_id, (counts.get(r.template_id) ?? 0) + 1);
  }
  const templates = ((templatesRaw as { id: string; name: string; buyer_type: string | null }[] | null) ?? []).map(
    (t) => ({ ...t, itemCount: counts.get(t.id) ?? 0 }),
  );
  return NextResponse.json({ templates });
}
