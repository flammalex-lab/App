import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { buildDailyOrdersCsv, ymdInET } from "@/lib/analytics/daily-orders-csv";

// Ad-hoc admin CSV. The daily auto-export runs from
// /api/cron/daily-orders-export — this endpoint is for one-off pulls
// (debugging, custom date ranges, re-running yesterday after a fix).
//
// Query params (all optional):
//   date=YYYY-MM-DD   single day shorthand (sets from=to=date)
//   from / to         inclusive YYYY-MM-DD range
//   by=placed|delivery  default: placed (placed_date in ET)
//   status=a,b,c      override default (exclude draft/cancelled)

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }

  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const byParam = (url.searchParams.get("by") ?? "placed").toLowerCase();
  const statusParam = url.searchParams.get("status");

  const isYmd = (s: string | null): s is string =>
    !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

  let from: string;
  let to: string;
  if (isYmd(dateParam)) {
    from = dateParam;
    to = dateParam;
  } else if (isYmd(fromParam) || isYmd(toParam)) {
    if (!isYmd(fromParam) || !isYmd(toParam)) {
      return NextResponse.json(
        { error: "both from and to are required (YYYY-MM-DD)" },
        { status: 400 },
      );
    }
    from = fromParam;
    to = toParam;
  } else {
    from = ymdInET(1);
    to = from;
  }
  if (from > to) {
    return NextResponse.json({ error: "from > to" }, { status: 400 });
  }

  const statuses = statusParam
    ? statusParam.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  try {
    const result = await buildDailyOrdersCsv(createServiceClient(), {
      from,
      to,
      by: byParam === "delivery" ? "delivery" : "placed",
      statuses,
    });
    return new NextResponse(result.csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store",
        "x-row-count": String(result.rowCount),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "export failed" },
      { status: 500 },
    );
  }
}
