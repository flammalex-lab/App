import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import { resolveActiveAccount } from "@/lib/auth/active-account";
import type { DeliveryZoneRow, Order, OrderStatus } from "@/lib/supabase/types";
import { StatusBadge } from "@/components/ui/Badge";
import { dateShort, dateLong, money } from "@/lib/utils/format";
import { nextDeliveryForZone } from "@/lib/utils/cutoff";

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

  // Look up next delivery + cutoff so the empty upcoming state can show
  // when the buyer's next opportunity is. Only fetch when actually
  // showing the empty upcoming state — saves a query on most loads.
  let nextDel: { deliveryDate: string; cutoffAt: string; deliveryDayName: string } | null = null;
  if (tab === "upcoming" && visible.length === 0 && active?.delivery_zone) {
    const { data: zoneRow } = await db
      .from("delivery_zones")
      .select("*")
      .eq("zone", active.delivery_zone)
      .maybeSingle();
    const zone = zoneRow as DeliveryZoneRow | null;
    if (zone) {
      const nd = nextDeliveryForZone(zone);
      if (nd) {
        nextDel = {
          deliveryDate: nd.deliveryDate.toISOString(),
          cutoffAt: nd.cutoffAt.toISOString(),
          deliveryDayName: nd.deliveryDayName,
        };
      }
    }
  }

  return (
    <div className="max-w-screen-xl mx-auto">
      <h1 className="display text-2xl mb-3">Orders</h1>

      <div className="flex border-b border-black/10 mb-3">
        <TabLink label={`Upcoming${upcoming.length ? ` · ${upcoming.length}` : ""}`} href="/orders" active={tab === "upcoming"} />
        <TabLink label={`Past${past.length ? ` · ${past.length}` : ""}`} href="/orders?tab=past" active={tab === "past"} />
      </div>

      {visible.length === 0 ? (
        <EmptyState tab={tab} nextDelivery={nextDel} />
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

function EmptyState({
  tab,
  nextDelivery,
}: {
  tab: TabKey;
  nextDelivery: { deliveryDate: string; cutoffAt: string; deliveryDayName: string } | null;
}) {
  if (tab === "past") {
    return (
      <div className="card p-8 text-center">
        <div className="mx-auto h-16 w-16 rounded-full bg-bg-secondary text-ink-secondary inline-flex items-center justify-center mb-3">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="3" width="14" height="18" rx="2" />
            <path d="M9 7h6M9 11h6M9 15h4" />
          </svg>
        </div>
        <p className="text-ink-secondary text-sm">
          Nothing here yet. Delivered orders will show up in this tab.
        </p>
      </div>
    );
  }

  // Upcoming empty: highlight the next delivery + cutoff so the buyer
  // immediately sees when they need to act. Falls back to a generic
  // CTA when no zone is set.
  return (
    <div className="card p-6 text-center">
      <div className="mx-auto h-14 w-14 rounded-full bg-brand-green-tint text-brand-green inline-flex items-center justify-center mb-4">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </div>
      <p className="text-[13px] text-ink-secondary mb-1">No upcoming orders.</p>
      {nextDelivery ? (
        <>
          <p className="display text-[22px] tracking-tight text-ink-primary mb-0.5">
            Next delivery {dateShort(nextDelivery.deliveryDate)}
          </p>
          <p className="text-[13px] text-ink-secondary mb-5">
            Order by{" "}
            <strong className="text-ink-primary">
              {new Date(nextDelivery.cutoffAt).toLocaleString("en-US", {
                weekday: "short",
                hour: "numeric",
                minute: "2-digit",
              })}
            </strong>
            {" "}({dateLong(nextDelivery.cutoffAt)})
          </p>
        </>
      ) : (
        <p className="text-[13px] text-ink-secondary mb-5 max-w-xs mx-auto">
          Your delivery zone isn&apos;t set yet — your rep will assign one and
          you&apos;ll see your next delivery date here.
        </p>
      )}
      <Link href="/guide" className="btn-primary inline-block">
        Start an order
      </Link>
    </div>
  );
}
