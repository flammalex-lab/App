import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { requireSameOrigin } from "@/lib/auth/same-origin";
import type { TablesInsert, TablesUpdate } from "@/lib/supabase/database.types";

/**
 * Columns an admin is allowed to set on an account via this endpoint.
 * DB-managed (id / created_at / updated_at / qb_synced_at) and any
 * cross-row foreign keys we don't want set from a JSON blob are
 * intentionally absent. Keeps a typo'd field or malicious extra key
 * from corrupting state.
 */
const ACCOUNT_EDITABLE_FIELDS = [
  "parent_account_id",
  "name",
  "type",
  "channel",
  "pricing_tier",
  "status",
  "enabled_categories",
  "primary_contact_name",
  "primary_contact_email",
  "primary_contact_phone",
  "address_line1",
  "address_line2",
  "city",
  "state",
  "zip",
  "delivery_zone",
  "delivery_day",
  "delivery_days",
  "delivery_notes",
  "order_minimum",
  "salesperson_id",
  "source",
  "notes",
  "buyer_type",
  "qb_customer_name",
  "qb_terms",
  "price_list_id",
] as const;

const ACCOUNT_EDITABLE_SET: ReadonlySet<string> = new Set(ACCOUNT_EDITABLE_FIELDS);

function pickAccountFields(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (ACCOUNT_EDITABLE_SET.has(k)) out[k] = v;
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
  const body = pickAccountFields(raw);
  const svc = createServiceClient();
  if (id === "new") {
    const { data, error } = await svc
      .from("accounts")
      .insert(body as TablesInsert<"accounts">)
      .select("id")
      .single();
    if (error || !data) return NextResponse.json({ error: error?.message ?? "no row" }, { status: 500 });
    return NextResponse.json({ id: data.id });
  }
  if (Object.keys(body).length === 0) {
    return NextResponse.json({ id });
  }
  const { error } = await svc
    .from("accounts")
    .update(body as TablesUpdate<"accounts">)
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id });
}
