import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";

interface Row {
  id: string;
  sku?: string;
  name?: string;
  pack_size?: string | null;
  needs_naming_review?: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
      pack_size: r.pack_size?.toString().trim() || null,
    };
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
