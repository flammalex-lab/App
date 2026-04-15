import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { dateShort, money } from "@/lib/utils/format";
import { StatusBadge } from "@/components/ui/Badge";
import type { Account, Order } from "@/lib/supabase/types";

export const metadata = { title: "Admin — Dashboard" };

export default async function DashboardPage() {
  const db = await createClient();

  const [{ data: recentOrders }, { data: pendingCount }, { data: qbPending }, { data: activeAccounts }, { data: followUps }] =
    await Promise.all([
      db.from("orders").select("*, account:accounts(name)").order("created_at", { ascending: false }).limit(10),
      db.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
      db.from("orders").select("id", { count: "exact", head: true }).eq("qb_exported", false).neq("status", "cancelled"),
      db.from("accounts").select("id", { count: "exact", head: true }).eq("status", "active"),
      db.from("activities").select("id", { count: "exact", head: true }).eq("completed", false).lte("follow_up_date", new Date().toISOString().slice(0, 10)),
    ]);

  // Revenue this month (billed orders, regardless of payment status)
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const { data: monthOrders } = await db
    .from("orders")
    .select("total")
    .gte("created_at", startOfMonth.toISOString())
    .neq("status", "cancelled");
  const mtd = ((monthOrders as { total: number }[] | null) ?? []).reduce((s, o) => s + Number(o.total), 0);

  return (
    <div className="max-w-6xl">
      <h1 className="text-3xl mb-4">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Pending orders" value={(pendingCount as any)?.count ?? 0} href="/admin/orders?status=pending" />
        <Stat label="To export (QB)" value={(qbPending as any)?.count ?? 0} href="/admin/qb" />
        <Stat label="Active accounts" value={(activeAccounts as any)?.count ?? 0} href="/admin/accounts" />
        <Stat label="Follow-ups due" value={(followUps as any)?.count ?? 0} href="/admin/accounts" />
        <Stat label="Revenue MTD" value={money(mtd)} />
      </div>

      <h2 className="text-xl mt-8 mb-2 font-serif">Recent orders</h2>
      <div className="card divide-y divide-black/5">
        {((recentOrders as (Order & { account: { name: string } | null })[] | null) ?? []).map((o) => (
          <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex items-center p-3 hover:bg-bg-secondary">
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="mono font-medium">{o.order_number}</span>
                <StatusBadge status={o.status} />
              </div>
              <div className="text-xs text-ink-secondary">
                {o.account?.name ?? "DTC"} · {dateShort(o.created_at)}
              </div>
            </div>
            <div className="mono text-sm">{money(o.total)}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const body = (
    <>
      <div className="text-xs text-ink-secondary">{label}</div>
      <div className="text-2xl mono mt-1">{value}</div>
    </>
  );
  if (href) return <Link href={href} className="card p-4 hover:shadow-lg transition">{body}</Link>;
  return <div className="card p-4">{body}</div>;
}
