import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import { buildInvoice } from "@/lib/accounting/build-invoice";
import { getAccountingService } from "@/lib/accounting";
import { buildCSVExport } from "@/lib/accounting/iif-export";
import type { Order, OrderItem, Product, Account, QBSetting } from "@/lib/supabase/types";

export async function POST(request: Request) {
  try { await requireAdmin(); } catch { return NextResponse.json({ error: "admin only" }, { status: 403 }); }
  const format = new URL(request.url).searchParams.get("format") ?? "iif";
  const svc = createServiceClient();

  const [{ data: orders }, { data: settings }] = await Promise.all([
    svc
      .from("orders")
      .select("*, account:accounts(*), items:order_items(*, product:products(*))")
      .eq("qb_exported", false)
      .neq("status", "cancelled")
      .order("created_at", { ascending: true }),
    svc.from("qb_settings").select("*"),
  ]);

  const qbSettings = (settings as QBSetting[] | null) ?? [];
  const rows = (orders as any[]) ?? [];
  if (!rows.length) return NextResponse.json({ error: "no orders to export" }, { status: 400 });

  // Resolve parents for accounts that have a parent_account_id, in one query.
  const parentIds = Array.from(
    new Set(rows.map((r) => r.account?.parent_account_id).filter(Boolean)),
  ) as string[];
  let parents: Record<string, { name: string; qb_customer_name: string | null }> = {};
  if (parentIds.length) {
    const { data: parentRows } = await svc
      .from("accounts")
      .select("id, name, qb_customer_name")
      .in("id", parentIds);
    for (const p of (parentRows as any[] | null) ?? []) {
      parents[p.id] = { name: p.name, qb_customer_name: p.qb_customer_name };
    }
  }

  const invoices = rows.map((r) => {
    const items = (r.items as (OrderItem & { product: Product })[]) ?? [];
    const acct = r.account as Account | null;
    const parent = acct?.parent_account_id ? parents[acct.parent_account_id] : null;
    return buildInvoice({
      order: r as Order,
      items,
      account: acct,
      parentAccount: parent ?? null,
      settings: qbSettings,
    });
  });

  let bundle;
  if (format === "csv") {
    bundle = buildCSVExport(invoices);
  } else {
    const service = getAccountingService();
    if (!service.buildExport) return NextResponse.json({ error: "provider has no file export" }, { status: 400 });
    bundle = await service.buildExport(invoices);
  }

  // Mark orders as exported
  await svc
    .from("orders")
    .update({ qb_exported: true, qb_exported_at: new Date().toISOString() })
    .in("id", bundle.orderIds);

  const bodyOut = typeof bundle.body === "string" ? bundle.body : new Uint8Array(bundle.body);
  return new NextResponse(bodyOut, {
    headers: {
      "Content-Type": bundle.mimeType,
      "x-filename": bundle.filename,
      "Content-Disposition": `attachment; filename="${bundle.filename}"`,
    },
  });
}
