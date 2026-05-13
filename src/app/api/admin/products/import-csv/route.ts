import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";

interface Row {
  id: string;
  sku?: string;
  name?: string;
  producer?: string | null;
  category?: string | null;
  sub_category?: string | null;
  case_pack?: string | null;
  pack_size?: string | null;
  needs_naming_review?: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_CATEGORIES = new Set([
  "meat", "dairy", "cheese", "produce", "pantry", "beverages",
]);

// Convert "" / undefined to null (clears the column), or trim a real value.
// Keep `undefined` distinct so partial CSVs (omitting a column entirely)
// leave the existing value alone — caller decides which keys to set.
function nullableText(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = v.toString().trim();
  return s ? s : null;
}

export async function POST(request: Request) {
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

    const update: Record<string, unknown> = {
      name: r.name.trim(),
    };
    const producer = nullableText(r.producer);
    if (producer !== undefined) update.producer = producer;

    if (r.category !== undefined && r.category !== null) {
      const cat = r.category.toString().trim().toLowerCase();
      if (cat && !VALID_CATEGORIES.has(cat)) {
        skipped++;
        if (errors.length < 10) errors.push({ id: r.id, reason: `invalid category "${cat}"` });
        continue;
      }
      if (cat) update.category = cat;
    }

    const subCategory = nullableText(r.sub_category);
    if (subCategory !== undefined) update.sub_category = subCategory;

    const casePack = nullableText(r.case_pack);
    if (casePack !== undefined) update.case_pack = casePack;

    const packSize = nullableText(r.pack_size);
    if (packSize !== undefined) update.pack_size = packSize;

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
