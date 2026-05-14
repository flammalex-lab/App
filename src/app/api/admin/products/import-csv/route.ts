import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { requireSameOrigin } from "@/lib/auth/same-origin";
import type { TablesUpdate } from "@/lib/supabase/database.types";

interface Row {
  id: string;
  sku?: string;
  name?: string;
  producer?: string | null;
  category?: string | null;
  product_group?: string | null;
  additional_groups?: string[] | null;
  sub_category?: string | null;
  case_pack?: string | null;
  pack_amount?: string | number | null;
  pack_unit?: string | null;
  pack_size?: string | null;
  needs_naming_review?: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_CATEGORIES = new Set([
  "meat", "dairy", "cheese", "produce", "pantry", "beverages",
]);
const VALID_GROUPS = new Set([
  "meat", "grocery", "produce", "dairy", "cheese",
]);

function nullableText(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = v.toString().trim();
  return s ? s : null;
}

function nullableNumber(v: string | number | null | undefined): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = v.toString().trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function POST(request: Request) {
  const originGate = requireSameOrigin(request);
  if (originGate) return originGate;
  try { await requireAdmin(); } catch {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }
  const { rows } = (await request.json()) as { rows: Row[] };
  if (!Array.isArray(rows)) {
    return NextResponse.json({ error: "rows must be an array" }, { status: 400 });
  }
  const svc = createServiceClient();

  let updated = 0, skipped = 0;
  const errors: Array<{ id: string; reason: string }> = [];

  for (const r of rows) {
    if (!r.id || !UUID_RE.test(r.id)) {
      skipped++;
      if (errors.length < 10) errors.push({ id: r.id ?? "(missing)", reason: "missing or invalid id" });
      continue;
    }
    if (!r.name || !r.name.trim()) {
      skipped++;
      if (errors.length < 10) errors.push({ id: r.id, reason: "name is required" });
      continue;
    }

    const update: TablesUpdate<"products"> = { name: r.name.trim() };

    const producer = nullableText(r.producer);
    if (producer !== undefined) update.producer = producer;

    if (r.category !== undefined && r.category !== null) {
      const cat = r.category.toString().trim().toLowerCase();
      if (cat && !VALID_CATEGORIES.has(cat)) {
        skipped++;
        if (errors.length < 10) errors.push({ id: r.id, reason: `invalid category "${cat}"` });
        continue;
      }
      if (cat) update.category = cat as TablesUpdate<"products">["category"];
    }

    if (r.product_group !== undefined && r.product_group !== null) {
      const g = r.product_group.toString().trim().toLowerCase();
      if (g && !VALID_GROUPS.has(g)) {
        skipped++;
        if (errors.length < 10) errors.push({ id: r.id, reason: `invalid product_group "${g}"` });
        continue;
      }
      if (g) update.product_group = g;
    }

    if (r.additional_groups !== undefined) {
      const list = Array.isArray(r.additional_groups) ? r.additional_groups : [];
      const cleaned = list
        .map((c) => c.toString().trim().toLowerCase())
        .filter((c) => c.length > 0);
      const invalid = cleaned.find((c) => !VALID_GROUPS.has(c));
      if (invalid) {
        skipped++;
        if (errors.length < 10) errors.push({ id: r.id, reason: `invalid additional_group "${invalid}" (valid: meat, grocery, produce, dairy, cheese)` });
        continue;
      }
      update.additional_groups = cleaned;
    }

    const subCategory = nullableText(r.sub_category);
    if (subCategory !== undefined) update.sub_category = subCategory;

    const casePack = nullableText(r.case_pack);
    if (casePack !== undefined) update.case_pack = casePack;

    const packAmount = nullableNumber(r.pack_amount);
    if (packAmount !== undefined) update.pack_amount = packAmount;

    const packUnit = nullableText(r.pack_unit);
    if (packUnit !== undefined) update.pack_unit = packUnit;

    // Recompute pack_size from amount + unit when both are present in the
    // CSV, so the display string stays in sync with the structured pair.
    // Falls back to the explicit pack_size column if amount/unit are absent.
    if (packAmount !== undefined && packUnit !== undefined) {
      update.pack_size = packAmount !== null && packUnit ? `${packAmount} ${packUnit}` : null;
    } else {
      const packSize = nullableText(r.pack_size);
      if (packSize !== undefined) update.pack_size = packSize;
    }

    if (r.needs_naming_review !== undefined) {
      update.needs_naming_review = r.needs_naming_review;
    }

    const { error, count } = await svc
      .from("products")
      .update(update, { count: "exact" })
      .eq("id", r.id);
    if (error) {
      skipped++;
      if (errors.length < 10) errors.push({ id: r.id, reason: error.message });
      continue;
    }
    if (count === 0) {
      skipped++;
      if (errors.length < 10) errors.push({ id: r.id, reason: "id not found" });
      continue;
    }
    updated++;
  }

  return NextResponse.json({ updated, skipped, errors });
}
