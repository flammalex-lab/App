import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import { resolveActiveAccount } from "@/lib/auth/active-account";
import type { Order, OrderStatus } from "@/lib/supabase/types";
import { StatusBadge } from "@/components/ui/Badge";
import { dateShort, money } from "@/lib/utils/format";

export const metadata = { title: "Orders — Fingerlakes Farms" };

const UPCOMING_STATUSES: OrderStatus[] = [
  "draft",
  "pending",
  "confirmed",
  "processing",
  "ready",
  "shipped",
];

type TabKey = "upcoming" | "past";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const impersonating = session.profile.role === "admin" ? getImpersonation() : null;
  const db = impersonating ? createServiceClient() : await createClient();
  const profileId = impersonating ?? session.userId;

  const { active } = await resolveActiveAccount(profileId, session.profile.account_id);

  // Scope by active account when available (multi-location buyers see only the
  // active one); fall back to profile_id for legacy accounts without a link.
  const base = db.from("orders").select("*").order("created_at", { ascending: false });
  const { data } = active
    ? await base.eq("account_id", active.id)
    : await base.eq("profile_id", profileId);

  const orders = (data as Order[] | null) ?? [];
  const upcoming = orders.filter((o) => UPCOMING_STATUSES.includes(o.status));
  const past = orders.filter((o) => !UPCOMING_STATUSES.includes(o.status));

  const sp = await searchParams;
  const tab: TabKey = sp.tab === "past" ? "past" : "upcoming";
  const visible = tab === "past" ? past : upcoming;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="display text-3xl mb-1">Orders</h1>
      {active ? (
        <p className="text-sm text-ink-secondary mb-4">{active.name}</p>
      ) : null}

      <div className="flex border-b border-black/10 mb-3">
        <TabLink label={`Upcoming${upcoming.length ? ` · ${upcoming.length}` : ""}`} href="/orders" active={tab === "upcoming"} />
        <TabLink label={`Past${past.length ? ` · ${past.length}` : ""}`} href="/orders?tab=past" active={tab === "past"} />
      </div>

      {visible.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <div className="card divide-y divide-black/5">
          {visible.map((o) => (
            <Link
              key={o.id}
              href={`/orders/${o.id}`}
              className="flex items-center p-4 hover:bg-bg-secondary"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium mono">{o.order_number}</span>
                  <StatusBadge status={o.status} />
                </div>
                <div className="text-xs text-ink-secondary">
                  {dateShort(o.created_at)} · {o.order_type.toUpperCase()}
                  {o.requested_delivery_date ? ` · deliver ${dateShort(o.requested_delivery_date)}` : ""}
                  {o.pickup_date ? ` · pickup ${dateShort(o.pickup_date)}` : ""}
                </div>
              </div>
              <div className="mono text-sm">{money(o.total)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function TabLink({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex-1 text-center py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
        active ? "border-brand-blue text-brand-blue" : "border-transparent text-ink-secondary hover:text-ink-primary"
      }`}
    >
      {label}
    </Link>
  );
}

function EmptyState({ tab }: { tab: TabKey }) {
  return (
    <div className="card p-8 text-center">
      <div className="mx-auto h-16 w-16 rounded-full bg-brand-green-tint text-brand-green inline-flex items-center justify-center mb-3">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M9 7h6M9 11h6M9 15h4" />
        </svg>
      </div>
      {tab === "upcoming" ? (
        <>
          <p className="text-ink-secondary text-sm mb-4">
            You&apos;re all set to start ordering! Jump to your guide and place one.
          </p>
          <Link href="/guide" className="btn-primary inline-block">
            Place an order
          </Link>
        </>
      ) : (
        <p className="text-ink-secondary text-sm">
          Nothing here yet. Delivered orders will show up in this tab.
        </p>
      )}
    </div>
  );
}
