import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Order, OrderStatus } from "@/lib/supabase/types";
import { StatusBadge } from "@/components/ui/Badge";
import { dateShort, money } from "@/lib/utils/format";

export const metadata = { title: "Admin — Orders" };

const STATUSES: OrderStatus[] = ["pending", "confirmed", "processing", "ready", "shipped", "delivered", "cancelled"];

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const filter = STATUSES.includes(sp.status as OrderStatus) ? (sp.status as OrderStatus) : null;
  const db = await createClient();

  let query = db.from("orders").select("*, account:accounts(name)").order("created_at", { ascending: false }).limit(200);
  if (filter) query = query.eq("status", filter);
  const { data } = await query;
  const orders = (data as (Order & { account: { name: string } | null })[] | null) ?? [];

  return (
    <div>
      <h1 className="text-3xl mb-4">Orders</h1>
      <div className="flex flex-wrap gap-2 mb-4 text-sm">
        <Tag href="/admin/orders" active={!filter}>All</Tag>
        {STATUSES.map((s) => (
          <Tag key={s} href={`/admin/orders?status=${s}`} active={filter === s}>{s}</Tag>
        ))}
      </div>
      <div className="card divide-y divide-black/5">
        {orders.map((o) => (
          <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex items-center p-3 hover:bg-bg-secondary">
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="mono font-medium">{o.order_number}</span>
                <StatusBadge status={o.status} />
                {o.qb_exported ? <span className="badge-gray">QB ✓</span> : null}
              </div>
              <div className="text-xs text-ink-secondary">
                {o.account?.name ?? "DTC"} · {dateShort(o.created_at)}
                {o.requested_delivery_date ? ` · deliver ${dateShort(o.requested_delivery_date)}` : ""}
                {o.pickup_date ? ` · pickup ${dateShort(o.pickup_date)}` : ""}
              </div>
            </div>
            <div className="mono text-sm">{money(o.total)}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Tag({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`px-3 py-1 rounded-full border ${active ? "bg-brand-green text-white border-brand-green" : "bg-white border-black/10"}`}>
      {children}
    </Link>
  );
}
