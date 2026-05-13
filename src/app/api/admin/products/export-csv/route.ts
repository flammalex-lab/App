import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";

// Column order is the order they show up in the spreadsheet. `id` first
// so the import side can match by UUID — never edit that column. The
// editable fields (name, producer, category, sub_category, case_pack,
// pack_size, needs_naming_review) all round-trip back through
// /api/admin/products/import-csv.
const CSV_COLUMNS = [
  "id",
  "sku",
  "name",
  "producer",
  "category",
  "sub_category",
  "case_pack",
  "pack_size",
  "needs_naming_review",
] as const;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request) {
  try { await requireAdmin(); } catch {
    return new Response(JSON.stringify({ error: "admin only" }), { status: 403 });
  }
  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "1";

  const svc = createServiceClient();
  let query = svc
    .from("products")
    .select(
      "id, sku, name, producer, category, sub_category, case_pack, pack_size, needs_naming_review",
    )
    .eq("is_active", true)
    .order("sort_order");
  if (!all) query = query.eq("needs_naming_review", true);

  const { data, error } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const lines = [CSV_COLUMNS.join(",")];
  for (const r of rows) {
    lines.push(CSV_COLUMNS.map((c) => csvCell(r[c])).join(","));
  }
  const csv = lines.join("\n") + "\n";

  const filename = all ? "products-all.csv" : "products-naming-review.csv";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
