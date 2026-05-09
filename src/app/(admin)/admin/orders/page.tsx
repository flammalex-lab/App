import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Order, OrderStatus } from "@/lib/supabase/types";
import { StatusBadge } from "@/components/ui/Badge";
import { dateShort, money } from "@/lib/utils/format";

export const metadata = { title: "Admin — Orders" };

const STATUSES: OrderStatus[] = ["pending", "confirmed", "processing", "ready", "shipped", "delivered", "cancelled"];
const PAGE_SIZE = 50;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const filter = STATUSES.includes(sp.status as OrderStatus) ? (sp.status as OrderStatus) : null;
  const page = Math.max(0, Number(sp.page ?? "0") || 0);
  const db = await createClient();

  // Fetch PAGE_SIZE + 1 instead of computing an exact count — count: 'exact'
  // runs SELECT COUNT(*) over the filtered table on every request, which
  // becomes expensive at 100k+ orders. The +1 row tells us whether there's
  // a next page (matches the pattern in admin/messages).
  //
  // PostgREST .range(from, to) is INCLUSIVE on both ends, so passing
  // (PAGE_SIZE + PAGE_SIZE) returns PAGE_SIZE+1 rows (indices 0..PAGE_SIZE
  // inclusive) — exactly what we want for the lookahead.
  let query = db
    .from("orders")
    .select("*, account:accounts(name)")
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  if (filter) query = query.eq("status", filter);
  const { data } = await query;
  const fetched = (data as (Order & { account: { name: string } | null })[] | null) ?? [];
  const orders = fetched.slice(0, PAGE_SIZE);
  const hasNext = fetched.length > PAGE_SIZE;

  const pageHref = (n: number) => {
    const params = new URLSearchParams();
    if (filter) params.set("status", filter);
    if (n > 0) params.set("page", String(n));
    const qs = params.toString();
    return `/admin/orders${qs ? `?${qs}` : ""}`;
  };

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
        {!orders.length ? <div className="p-4 text-sm text-ink-secondary">No orders.</div> : null}
      </div>
      {(page > 0 || hasNext) ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-ink-secondary">
            Showing {orders.length ? page * PAGE_SIZE + 1 : 0}–{page * PAGE_SIZE + orders.length}
          </span>
          <div className="flex gap-2">
            {page > 0 ? (
              <Link href={pageHref(page - 1)} className="px-3 py-1 rounded border border-black/10 bg-white hover:bg-bg-secondary">
                ← Prev
              </Link>
            ) : null}
            {hasNext ? (
              <Link href={pageHref(page + 1)} className="px-3 py-1 rounded border border-black/10 bg-white hover:bg-bg-secondary">
                Next →
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
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
