import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import type { Category, Brand } from "@/lib/supabase/types";

interface Row {
  sku: string;
  upc?: string;
  name: string;
  description?: string;
  wholesale_price?: number;
  retail_price?: number;
  unit?: string;
  pack_size?: string;
  case_pack?: string;
  producer?: string;
  income_account?: string;
  category_hint?: string;
  brand_hint?: string;
}

/**
 * Infer the product category from the QB item type / category hint text.
 * Falls back to 'pantry' since that's the broadest bucket for unknown items.
 */
function guessCategory(hint: string | undefined, name: string): Category {
  const s = `${hint ?? ""} ${name ?? ""}`.toLowerCase();
  if (/\b(beef|steak|sirloin|brisket|tenderloin|ribeye|chuck|ground beef|oxtail|hanger|flank)\b/.test(s)) return "beef";
  if (/\b(pork|bacon|ham|kielbasa|sausage|ribs|chop)\b/.test(s)) return "pork";
  if (/\b(lamb|mutton)\b/.test(s)) return "lamb";
  if (/\b(egg|eggs)\b/.test(s)) return "eggs";
  if (/\b(milk|yogurt|cheese|cheddar|butter|cream|kefir|dairy|brie|feta)\b/.test(s)) return "dairy";
  if (/\b(vegetable|fruit|salad|apple|lettuce|spinach|tomato|beet|carrot|onion|potato|herb|green|produce)\b/.test(s)) return "produce";
  if (/\b(beverage|drink|juice|water|kombucha|soda|coffee|tea|lemonade|cider)\b/.test(s)) return "beverages";
  return "pantry";
}

function guessBrand(hint: string | undefined, name: string): Brand {
  const s = `${hint ?? ""} ${name ?? ""}`.toLowerCase();
  if (/grassland/.test(s)) return "grasslands";
  if (/meadow ?creek/.test(s)) return "meadow_creek";
  return "fingerlakes_farms";
}

export async function POST(request: Request) {
  try { await requireAdmin(); } catch { return NextResponse.json({ error: "admin only" }, { status: 403 }); }
  const { rows } = (await request.json()) as { rows: Row[] };
  const svc = createServiceClient();

  let created = 0, updated = 0, skipped = 0;
  const errors: Array<{ sku: string; reason: string }> = [];

  for (const r of rows) {
    if (!r.sku || !r.name) {
      skipped++;
      if (errors.length < 10) errors.push({ sku: r.sku ?? "(missing)", reason: "missing sku or name" });
      continue;
    }
    // Use limit(1) instead of maybeSingle() — maybeSingle errors on >1 rows
    // (e.g. from a prior partial import) and would silently fall through to
    // the insert path, failing the unique constraint.
    const { data: existingRows, error: lookupErr } = await svc
      .from("products")
      .select("id")
      .eq("sku", r.sku)
      .limit(1);
    if (lookupErr) {
      skipped++;
      if (errors.length < 10) errors.push({ sku: r.sku, reason: `lookup: ${lookupErr.message}` });
      continue;
    }
    const existing = existingRows?.[0];

    const payload: Record<string, unknown> = {
      sku: r.sku,
      upc: r.upc ?? null,
      name: r.name,
      description: r.description ?? null,
      wholesale_price: r.wholesale_price ?? null,
      retail_price: r.retail_price ?? null,
      unit: r.unit?.toLowerCase() || "each",
      pack_size: r.pack_size ?? null,
      case_pack: r.case_pack ?? null,
      producer: r.producer ?? null,
      qb_income_account: r.income_account ?? null,
      category: guessCategory(r.category_hint, r.name),
      brand: guessBrand(r.brand_hint, r.name),
      available_b2b: true,
      is_active: true,
    };

    if (existing) {
      // Update — but don't overwrite image_url, description if the CSV doesn't have them
      const updatePayload: Record<string, unknown> = {
        name: payload.name,
        wholesale_price: payload.wholesale_price,
        retail_price: payload.retail_price,
        unit: payload.unit,
        pack_size: payload.pack_size,
        qb_income_account: payload.qb_income_account,
      };
      if (r.upc) updatePayload.upc = r.upc;
      if (r.case_pack) updatePayload.case_pack = r.case_pack;
      if (r.producer) updatePayload.producer = r.producer;
      if (r.description) updatePayload.description = r.description;
      const { error } = await svc.from("products").update(updatePayload).eq("id", (existing as any).id);
      if (error) {
        skipped++;
        if (errors.length < 10) errors.push({ sku: r.sku, reason: `update: ${error.message}` });
        continue;
      }
      updated++;
    } else {
      const { error } = await svc.from("products").insert(payload);
      if (error) {
        skipped++;
        if (errors.length < 10) errors.push({ sku: r.sku, reason: `insert: ${error.message}` });
        continue;
      }
      created++;
    }
  }

  return NextResponse.json({ created, updated, skipped, errors });
}
