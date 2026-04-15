import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { dateShort, money } from "@/lib/utils/format";
import type { Order } from "@/lib/supabase/types";
import { QBExportForm } from "./QBExportForm";

export const metadata = { title: "Admin — QuickBooks" };

export default async function QBPage() {
  const db = await createClient();
  const { data: pending } = await db
    .from("orders")
    .select("*, account:accounts(name, qb_customer_name)")
    .eq("qb_exported", false)
    .neq("status", "cancelled")
    .order("created_at", { ascending: true });

  const rows = ((pending as any[]) ?? []);
  const unmapped = rows.filter((r) => !r.account?.qb_customer_name && r.order_type === "b2b");

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-3xl">QuickBooks export</h1>

      <div className="card p-4">
        <h2 className="font-serif text-lg mb-2">Phase 1 — IIF / CSV export</h2>
        <p className="text-sm text-ink-secondary mb-3">
          Produces a QuickBooks-importable file of every un-exported order. After download,
          open QuickBooks Desktop → File → Utilities → Import → IIF Files.
        </p>
        {unmapped.length > 0 ? (
          <div className="rounded-md bg-feedback-error/10 text-feedback-error text-sm p-3 mb-3">
            {unmapped.length} B2B orders reference accounts without a QB Customer:Job mapping.
            Set it on each account before exporting.
          </div>
        ) : null}
        <QBExportForm pendingCount={rows.length} />
      </div>

      <div className="card">
        <div className="p-4 border-b border-black/5">
          <h2 className="font-serif text-lg">Unexported orders ({rows.length})</h2>
        </div>
        <div className="divide-y divide-black/5">
          {rows.map((r: any) => (
            <Link key={r.id} href={`/admin/orders/${r.id}`} className="p-3 flex hover:bg-bg-secondary">
              <div className="flex-1">
                <span className="mono font-medium">{r.order_number}</span>
                <div className="text-xs text-ink-secondary">
                  {dateShort(r.created_at)} · {r.account?.name ?? "DTC"}
                  {!r.account?.qb_customer_name && r.order_type === "b2b" ? (
                    <span className="ml-2 text-feedback-error">· unmapped</span>
                  ) : null}
                </div>
              </div>
              <div className="mono text-sm">{money(r.total)}</div>
            </Link>
          ))}
          {!rows.length ? <div className="p-4 text-sm text-ink-secondary">Nothing to export.</div> : null}
        </div>
      </div>

      <div className="card p-4">
        <h2 className="font-serif text-lg mb-2">Phase 2 — Live sync</h2>
        <p className="text-sm text-ink-secondary">
          When Conductor is installed on the QBD machine, switch
          <code className="mono text-xs ml-1">ACCOUNTING_PROVIDER=conductor</code>. No code changes needed — the service layer picks it up automatically.
        </p>
      </div>
    </div>
  );
}
