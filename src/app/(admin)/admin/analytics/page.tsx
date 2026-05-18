import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { money } from "@/lib/utils/format";

export const metadata = { title: "Admin — Analytics" };
export const dynamic = "force-dynamic";

// At-a-glance dashboard. All numbers query v_order_lines + buyer_events
// directly — no materialized views yet (small data). When volume grows we
// can move the rollups to nightly materialized views without changing
// this page's shape.

interface LineRow {
  order_id: string;
  order_number: string;
  account_name: string | null;
  account_buyer_type: string | null;
  product_id: string | null;
  product_name: string | null;
  product_sku: string | null;
  product_category: string | null;
  product_producer: string | null;
  quantity: string | number | null;
  unit_price: string | number | null;
  line_total: string | number | null;
  line_gross_margin: string | number | null;
  order_total: string | number | null;
  placed_at: string | null;
  placed_date: string | null;
  status: string | null;
}

function n(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function ymdInET(daysBack: number): string {
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

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const daysRaw = Number(sp.days ?? "30");
  const days = Number.isFinite(daysRaw) && daysRaw > 0 && daysRaw <= 365 ? Math.floor(daysRaw) : 30;
  const from = ymdInET(days - 1);
  const to = ymdInET(0);

  const svc = createServiceClient();
  const { data: lines } = await svc
    .from("v_order_lines")
    .select(
      "order_id, order_number, account_name, account_buyer_type, product_id, product_name, product_sku, product_category, product_producer, quantity, unit_price, line_total, line_gross_margin, order_total, placed_at, placed_date, status",
    )
    .gte("placed_date", from)
    .lte("placed_date", to)
    .not("status", "in", "(draft,cancelled)")
    .limit(50_000);

  const rows = (lines as unknown as LineRow[] | null) ?? [];

  // Top-line numbers. Iterate once and aggregate everything we need.
  const orderIds = new Set<string>();
  const orderTotalByOrder = new Map<string, number>();
  let lineRevenue = 0;
  let lineUnits = 0;
  let lineGrossMargin = 0;
  const accountAgg = new Map<string, { name: string; buyer_type: string | null; revenue: number; orders: Set<string> }>();
  const productAgg = new Map<string, { name: string; sku: string | null; producer: string | null; category: string | null; revenue: number; units: number }>();
  const categoryAgg = new Map<string, { revenue: number; units: number }>();
  const dailyAgg = new Map<string, { revenue: number; orders: Set<string> }>();

  for (const r of rows) {
    if (r.order_id) orderIds.add(r.order_id);
    if (r.order_id && r.order_total != null && !orderTotalByOrder.has(r.order_id)) {
      orderTotalByOrder.set(r.order_id, n(r.order_total));
    }
    lineRevenue += n(r.line_total);
    lineUnits += n(r.quantity);
    lineGrossMargin += n(r.line_gross_margin);

    const acctName = r.account_name ?? "(no account)";
    const a = accountAgg.get(acctName) ?? {
      name: acctName,
      buyer_type: r.account_buyer_type,
      revenue: 0,
      orders: new Set<string>(),
    };
    a.revenue += n(r.line_total);
    if (r.order_id) a.orders.add(r.order_id);
    accountAgg.set(acctName, a);

    const pid = r.product_id ?? r.product_name ?? "(unknown)";
    const p = productAgg.get(pid) ?? {
      name: r.product_name ?? "(unknown)",
      sku: r.product_sku,
      producer: r.product_producer,
      category: r.product_category,
      revenue: 0,
      units: 0,
    };
    p.revenue += n(r.line_total);
    p.units += n(r.quantity);
    productAgg.set(pid, p);

    const cat = r.product_category ?? "(uncategorized)";
    const c = categoryAgg.get(cat) ?? { revenue: 0, units: 0 };
    c.revenue += n(r.line_total);
    c.units += n(r.quantity);
    categoryAgg.set(cat, c);

    const day = r.placed_date ?? "(unknown)";
    const d = dailyAgg.get(day) ?? { revenue: 0, orders: new Set<string>() };
    d.revenue += n(r.line_total);
    if (r.order_id) d.orders.add(r.order_id);
    dailyAgg.set(day, d);
  }

  const totalOrders = orderIds.size;
  const orderRevenue = Array.from(orderTotalByOrder.values()).reduce((s, x) => s + x, 0);
  const avgOrderValue = totalOrders > 0 ? orderRevenue / totalOrders : 0;

  const topAccounts = Array.from(accountAgg.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
  const topProducts = Array.from(productAgg.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 15);
  const categories = Array.from(categoryAgg.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue);
  const dailySeries = Array.from(dailyAgg.entries())
    .map(([date, v]) => ({ date, revenue: v.revenue, orders: v.orders.size }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const maxDailyRev = dailySeries.reduce((m, d) => Math.max(m, d.revenue), 0);

  // App-usage events: top 10 event names in the same window.
  // Use `${from}T00:00:00Z` as the lower bound — gte on a timestamptz
  // column with a date-string boundary is good enough for a dashboard.
  const { data: eventCountsRaw } = await svc
    .from("buyer_events")
    .select("event_name")
    .gte("created_at", from + "T00:00:00Z")
    .limit(5_000);
  const eventCountMap = new Map<string, number>();
  for (const row of (eventCountsRaw as { event_name: string }[] | null) ?? []) {
    eventCountMap.set(row.event_name, (eventCountMap.get(row.event_name) ?? 0) + 1);
  }
  const topEvents = Array.from(eventCountMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-wrap items-end gap-4 justify-between">
        <div>
          <h1 className="display text-3xl tracking-tight">Analytics</h1>
          <p className="text-sm text-ink-tertiary mt-1">
            {from} → {to} · America/New_York
          </p>
        </div>
        <div className="flex gap-1 text-sm">
          {[7, 30, 90, 180].map((d) => (
            <Link
              key={d}
              href={`/admin/analytics?days=${d}`}
              className={
                "px-3 py-1.5 rounded-md border " +
                (d === days
                  ? "bg-ink text-white border-ink"
                  : "border-black/10 hover:bg-black/5")
              }
            >
              {d}d
            </Link>
          ))}
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Revenue" value={money(orderRevenue)} sub={`${money(lineRevenue)} in lines`} />
        <Kpi label="Orders" value={String(totalOrders)} sub={`${rows.length} line items`} />
        <Kpi label="Avg order" value={money(avgOrderValue)} sub={`across ${totalOrders} orders`} />
        <Kpi
          label="Gross margin"
          value={money(lineGrossMargin)}
          sub={
            orderRevenue > 0
              ? `${((lineGrossMargin / orderRevenue) * 100).toFixed(1)}% of revenue`
              : "—"
          }
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Daily revenue">
          {dailySeries.length === 0 ? (
            <Empty>No orders in this range.</Empty>
          ) : (
            <ul className="space-y-1.5">
              {dailySeries.slice(-30).map((d) => (
                <li key={d.date} className="grid grid-cols-[7.5rem_1fr_5rem] items-center gap-2 text-sm">
                  <span className="text-ink-tertiary tabular-nums">{d.date}</span>
                  <span className="h-2 rounded-full bg-black/5 overflow-hidden">
                    <span
                      className="block h-full bg-brand-blue"
                      style={{
                        width: maxDailyRev > 0 ? `${(d.revenue / maxDailyRev) * 100}%` : "0%",
                      }}
                    />
                  </span>
                  <span className="text-right tabular-nums">{money(d.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Category breakdown">
          {categories.length === 0 ? (
            <Empty>No data yet.</Empty>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-ink-tertiary">
                <tr>
                  <th className="text-left py-2">Category</th>
                  <th className="text-right py-2">Units</th>
                  <th className="text-right py-2">Revenue</th>
                  <th className="text-right py-2">Share</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.name} className="border-t border-black/5">
                    <td className="py-2 capitalize">{c.name}</td>
                    <td className="py-2 text-right tabular-nums">{c.units.toFixed(0)}</td>
                    <td className="py-2 text-right tabular-nums">{money(c.revenue)}</td>
                    <td className="py-2 text-right tabular-nums text-ink-tertiary">
                      {lineRevenue > 0 ? ((c.revenue / lineRevenue) * 100).toFixed(0) + "%" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title={`Top accounts (${topAccounts.length})`}>
          {topAccounts.length === 0 ? (
            <Empty>No accounts ordered in this range.</Empty>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-ink-tertiary">
                <tr>
                  <th className="text-left py-2">Account</th>
                  <th className="text-right py-2">Orders</th>
                  <th className="text-right py-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topAccounts.map((a) => (
                  <tr key={a.name} className="border-t border-black/5">
                    <td className="py-2">
                      <div>{a.name}</div>
                      {a.buyer_type ? (
                        <div className="text-xs text-ink-tertiary">{a.buyer_type}</div>
                      ) : null}
                    </td>
                    <td className="py-2 text-right tabular-nums">{a.orders.size}</td>
                    <td className="py-2 text-right tabular-nums">{money(a.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title={`Top products (${topProducts.length})`}>
          {topProducts.length === 0 ? (
            <Empty>No products ordered.</Empty>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-ink-tertiary">
                <tr>
                  <th className="text-left py-2">Product</th>
                  <th className="text-right py-2">Units</th>
                  <th className="text-right py-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.name + (p.sku ?? "")} className="border-t border-black/5">
                    <td className="py-2">
                      <div>{p.name}</div>
                      <div className="text-xs text-ink-tertiary">
                        {[p.producer, p.category, p.sku].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td className="py-2 text-right tabular-nums">{p.units.toFixed(0)}</td>
                    <td className="py-2 text-right tabular-nums">{money(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </section>

      <section>
        <Card title="App-usage events (live)">
          {topEvents.length === 0 ? (
            <Empty>
              No events captured yet. The first <code>add_to_cart</code> or{" "}
              <code>order_placed</code> fires once buyers start using the app.
            </Empty>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-ink-tertiary">
                <tr>
                  <th className="text-left py-2">Event</th>
                  <th className="text-right py-2">Count</th>
                </tr>
              </thead>
              <tbody>
                {topEvents.map((e) => (
                  <tr key={e.name} className="border-t border-black/5">
                    <td className="py-2 font-mono text-xs">{e.name}</td>
                    <td className="py-2 text-right tabular-nums">{e.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </section>

      <footer className="text-xs text-ink-tertiary pt-4 border-t border-black/5">
        Need the raw rows? Pull a CSV from{" "}
        <code className="bg-black/5 px-1 rounded">/api/admin/exports/daily-orders?date=YYYY-MM-DD</code>{" "}
        or query <code className="bg-black/5 px-1 rounded">v_order_lines</code> directly in
        Supabase Studio.
      </footer>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-black/5 bg-white p-4">
      <div className="text-xs uppercase tracking-wider text-ink-tertiary">{label}</div>
      <div className="text-2xl mt-1 tabular-nums">{value}</div>
      {sub ? <div className="text-xs text-ink-tertiary mt-0.5">{sub}</div> : null}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-black/5 bg-white p-4">
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-ink-tertiary py-6">{children}</div>;
}
