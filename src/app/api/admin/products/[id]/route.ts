import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { CATALOG_SUGGESTIONS_TAG } from "@/lib/products/suggestions";
import { requireSameOrigin } from "@/lib/auth/same-origin";
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database.types";

/**
 * Columns an admin is allowed to set via this endpoint. Locked down
 * explicitly so a typo or malicious extra key in the JSON body can't
 * corrupt rows (e.g. setting `id`, scribbling `created_at`, or stamping
 * `account_id` onto a product row). DB-managed columns
 * (id / created_at / updated_at / qb_synced_at-equivalents) are
 * intentionally absent.
 */
const PRODUCT_EDITABLE_FIELDS = [
  "sku",
  "upc",
  "brand",
  "category",
  "sub_category",
  "product_group",
  "additional_groups",
  "name",
  "description",
  "primal",
  "sub_primal",
  "cut_type",
  "unit",
  "pack_size",
  "pack_amount",
  "pack_unit",
  "case_pack",
  "avg_weight_lbs",
  "wholesale_price",
  "retail_price",
  "available_b2b",
  "available_dtc",
  "in_season",
  "available_this_week",
  "is_active",
  "is_peak",
  "private",
  "image_url",
  "producer",
  "pack_options",
  "price_by_weight",
  "qb_income_account",
  "sort_order",
  "needs_naming_review",
] as const;

const PRODUCT_EDITABLE_SET: ReadonlySet<string> = new Set(PRODUCT_EDITABLE_FIELDS);

function pickProductFields(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (PRODUCT_EDITABLE_SET.has(k)) out[k] = v;
  }
  return out;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originGate = requireSameOrigin(request);
  if (originGate) return originGate;
  try { await requireAdmin(); } catch { return NextResponse.json({ error: "admin only" }, { status: 403 }); }
  const { id } = await params;
  let raw: unknown;
  try { raw = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }
  const body = pickProductFields(raw);
  const svc = createServiceClient();
  if (id === "new") {
    const { data, error } = await svc
      .from("products")
      .insert(body as TablesInsert<"products">)
      .select("id")
      .single();
    if (error || !data) return NextResponse.json({ error: error?.message ?? "no row" }, { status: 500 });
    revalidateTag(CATALOG_SUGGESTIONS_TAG, "max");
    return NextResponse.json({ id: data.id });
  }
  if (Object.keys(body).length === 0) {
    // Nothing to update — avoid issuing a no-op write that still updates
    // `updated_at` and noises up the audit trail.
    return NextResponse.json({ id });
  }
  const { error } = await svc
    .from("products")
    .update(body as TablesUpdate<"products">)
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidateTag(CATALOG_SUGGESTIONS_TAG, "max");
  return NextResponse.json({ id });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originGate = requireSameOrigin(request);
  if (originGate) return originGate;
  try { await requireAdmin(); } catch { return NextResponse.json({ error: "admin only" }, { status: 403 }); }
  const { id } = await params;
  const svc = createServiceClient();
  // Soft delete via is_active to preserve order history FKs.
  const { error } = await svc.from("products").update({ is_active: false }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidateTag(CATALOG_SUGGESTIONS_TAG, "max");
  return NextResponse.json({ ok: true });
}
