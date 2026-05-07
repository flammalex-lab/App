import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { dateShort, money } from "@/lib/utils/format";
import { StatusBadge } from "@/components/ui/Badge";
import type { Order } from "@/lib/supabase/types";

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
      <h1 className="display text-3xl mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Pending orders" value={(pendingCount as any)?.count ?? 0} href="/admin/orders?status=pending" tone="gold" />
        <Stat label="To export (QB)" value={(qbPending as any)?.count ?? 0} href="/admin/qb" tone="blue" />
        <Stat label="Active accounts" value={(activeAccounts as any)?.count ?? 0} href="/admin/accounts" />
        <Stat label="Follow-ups due" value={(followUps as any)?.count ?? 0} href="/admin/accounts" tone={((followUps as any)?.count ?? 0) > 0 ? "rust" : undefined} />
        <Stat label="Revenue MTD" value={money(mtd)} tone="green" />
      </div>

      <div className="flex items-baseline justify-between mt-10 mb-3">
        <h2 className="display text-xl">Recent orders</h2>
        <Link href="/admin/orders" className="text-sm text-brand-blue hover:underline">View all →</Link>
      </div>
      <div className="card divide-y divide-black/5 overflow-hidden">
        {((recentOrders as (Order & { account: { name: string } | null })[] | null) ?? []).map((o) => (
          <Link
            key={o.id}
            href={`/admin/orders/${o.id}`}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-bg-secondary transition"
          >
            <span className="tabular font-medium text-ink-primary">{o.order_number}</span>
            <div className="min-w-0 flex items-center gap-2">
              <span className="truncate text-sm text-ink-secondary">
                {o.account?.name ?? "DTC"} · {dateShort(o.created_at)}
              </span>
              <StatusBadge status={o.status} />
            </div>
            <span className="tabular font-semibold text-ink-primary">{money(o.total)}</span>
          </Link>
        ))}
        {!((recentOrders as any[]) ?? []).length ? (
          <div className="p-8 text-sm text-ink-secondary text-center">
            No orders yet. Accounts with buyers on the portal will show up here as they order.
          </div>
        ) : null}
      </div>
    </div>
  );
}

type Tone = "blue" | "green" | "gold" | "rust";
const toneStyles: Record<Tone, string> = {
  blue: "text-brand-blue",
  green: "text-brand-green-dark",
  gold: "text-[#8a690f]",
  rust: "text-[#7a3b1f]",
};

function Stat({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: string | number;
  href?: string;
  tone?: Tone;
}) {
  const body = (
    <>
      <div className={`display tabular text-3xl lg:text-4xl font-bold tracking-tight ${tone ? toneStyles[tone] : "text-ink-primary"}`}>
        {value}
      </div>
      <div className="text-xs text-ink-secondary mt-1 uppercase tracking-wide">{label}</div>
    </>
  );
  if (href) {
    return (
      <Link href={href} className="card p-4 hover:shadow-lg hover:-translate-y-0.5 transition">
        {body}
      </Link>
    );
  }
  return <div className="card p-4">{body}</div>;
}
