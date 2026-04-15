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
    svc.from("orders")
      .select("*, account:accounts(*), parent:accounts!accounts_parent_account_id_fkey(*), items:order_items(*, product:products(*))")
      .eq("qb_exported", false)
      .neq("status", "cancelled")
      .order("created_at", { ascending: true }),
    svc.from("qb_settings").select("*"),
  ]);

  const qbSettings = (settings as QBSetting[] | null) ?? [];
  const rows = (orders as any[]) ?? [];
  if (!rows.length) return NextResponse.json({ error: "no orders to export" }, { status: 400 });

  const invoices = rows.map((r) => {
    const items = (r.items as (OrderItem & { product: Product })[]) ?? [];
    return buildInvoice({
      order: r as Order,
      items,
      account: r.account as Account | null,
      parentAccount: (r.account as any)?.parent_account_id
        ? ({ name: r.parent?.name, qb_customer_name: r.parent?.qb_customer_name } as any)
        : null,
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

  return new NextResponse(bundle.body, {
    headers: {
      "Content-Type": bundle.mimeType,
      "x-filename": bundle.filename,
      "Content-Disposition": `attachment; filename="${bundle.filename}"`,
    },
  });
}
