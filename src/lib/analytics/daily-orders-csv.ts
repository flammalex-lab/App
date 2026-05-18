import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Single source of truth for the daily-orders CSV. Used by:
//   - /api/admin/exports/daily-orders (ad-hoc admin download)
//   - /api/cron/daily-orders-export   (auto-emailed each morning)
//
// Returns the CSV body, filename, and the row count so callers can log
// whether a quiet day means "no orders" vs "query failed."

export interface BuildDailyCsvOpts {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  by?: "placed" | "delivery";
  statuses?: string[]; // overrides the default "exclude draft/cancelled"
}

export interface BuildDailyCsvResult {
  csv: string;
  filename: string;
  rowCount: number;
  totals: {
    orders: number;
    subtotal: number;
    delivery_fee: number;
    grand_total: number;
  };
}

const HEADERS = [
  "order_number",
  "order_type",
  "status",
  "payment_method",
  "payment_status",
  "account_name",
  "account_buyer_type",
  "account_type",
  "delivery_zone",
  "buyer_name",
  "buyer_email",
  "placed_at",
  "placed_date",
  "requested_delivery_date",
  "delivered_at",
  "product_sku",
  "product_name",
  "product_category",
  "product_sub_category",
  "product_producer",
  "product_brand",
  "product_pack_size",
  "product_unit",
  "pack_variant_key",
  "quantity",
  "unit_price",
  "wholesale_price_at_order",
  "line_total",
  "line_gross_margin",
  "order_subtotal",
  "order_delivery_fee",
  "order_total",
  "line_notes",
  "customer_notes",
];

export async function buildDailyOrdersCsv(
  svc: SupabaseClient<Database>,
  opts: BuildDailyCsvOpts,
): Promise<BuildDailyCsvResult> {
  const dateColumn = opts.by === "delivery" ? "requested_delivery_date" : "placed_date";

  // select("*") + filter at emit. The typed PostgREST builder doesn't
  // accept a runtime-built comma-string of columns; "*" returns every
  // view column and we just project HEADERS at CSV write time. View has
  // ~30 cols so the wire size is fine for tens of thousands of lines.
  let q = svc
    .from("v_order_lines")
    .select("*")
    .gte(dateColumn, opts.from)
    .lte(dateColumn, opts.to)
    .order("placed_at", { ascending: true })
    .limit(50_000);

  if (opts.statuses && opts.statuses.length) {
    q = q.in("status", opts.statuses);
  } else {
    q = q.not("status", "in", "(draft,cancelled)");
  }

  const { data, error } = await q;
  if (error) throw new Error(`v_order_lines query failed: ${error.message}`);
  const rows = (data ?? []) as unknown as Record<string, unknown>[];

  const lines: string[] = [HEADERS.join(",")];
  const orderTotals = new Map<string, { subtotal: number; delivery_fee: number; total: number }>();
  for (const r of rows) {
    lines.push(HEADERS.map((h) => csvEscape(r[h])).join(","));
    // De-dupe per-order header dollars across line items.
    const orderNum = String(r["order_number"] ?? "");
    if (orderNum && !orderTotals.has(orderNum)) {
      orderTotals.set(orderNum, {
        subtotal: numeric(r["order_subtotal"]),
        delivery_fee: numeric(r["order_delivery_fee"]),
        total: numeric(r["order_total"]),
      });
    }
  }

  const totals = { orders: orderTotals.size, subtotal: 0, delivery_fee: 0, grand_total: 0 };
  for (const t of orderTotals.values()) {
    totals.subtotal += t.subtotal;
    totals.delivery_fee += t.delivery_fee;
    totals.grand_total += t.total;
  }

  const filename =
    opts.from === opts.to
      ? `flf-orders-${opts.from}.csv`
      : `flf-orders-${opts.from}_to_${opts.to}.csv`;

  return {
    csv: lines.join("\n") + "\n",
    filename,
    rowCount: rows.length,
    totals,
  };
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function numeric(v: unknown): number {
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// "Yesterday" (or N days back) in America/New_York, returned YYYY-MM-DD.
export function ymdInET(daysBack = 0): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayEt = fmt.format(new Date());
  const d = new Date(todayEt + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - daysBack);
  return fmt.format(d);
}
