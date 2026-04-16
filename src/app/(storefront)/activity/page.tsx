import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import type { Message, Order } from "@/lib/supabase/types";
import { dateShort, money, relativeTime } from "@/lib/utils/format";
import { ActivityComposer } from "./ActivityComposer";

export const metadata = { title: "Activity — Fingerlakes Farms" };

interface OrderEvent {
  kind: "order";
  ts: string;
  order: Order;
}
interface MessageEvent {
  kind: "message";
  ts: string;
  message: Message;
  isMine: boolean;
}
type Event = OrderEvent | MessageEvent;

export default async function ActivityPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const impersonating = session.profile.role === "admin" ? getImpersonation() : null;
  const db = impersonating ? createServiceClient() : await createClient();
  const profileId = impersonating ?? session.userId;

  const { data: me } = await db.from("profiles").select("*").eq("id", profileId).maybeSingle();
  if (!me) redirect("/login");

  const accountId = me.account_id;

  // Pull last 50 orders + last 50 messages, merge chronologically
  const [{ data: orderRows }, { data: messageRows }] = await Promise.all([
    db
      .from("orders")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(50),
    accountId
      ? db
          .from("messages")
          .select("*")
          .eq("account_id", accountId)
          .order("created_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] as Message[] }),
  ]);

  const orderEvents: Event[] = ((orderRows as Order[] | null) ?? []).map((o) => ({
    kind: "order",
    ts: o.created_at,
    order: o,
  }));
  const messageEvents: Event[] = ((messageRows as Message[] | null) ?? []).map((m) => ({
    kind: "message",
    ts: m.created_at,
    message: m,
    isMine: m.from_profile_id === profileId,
  }));

  const events = [...orderEvents, ...messageEvents].sort((a, b) =>
    a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0,
  );

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="display text-3xl mb-1">Activity</h1>
      <p className="text-ink-secondary text-sm mb-4">
        Orders, updates, and messages between you and your rep — newest first.
      </p>

      {accountId ? (
        <div className="mb-4">
          <ActivityComposer />
        </div>
      ) : null}

      {events.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-5xl mb-3 opacity-30">💬</div>
          <p className="text-ink-secondary">No activity yet. Once you place an order or message your rep, it&apos;ll show up here.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {events.map((e) =>
            e.kind === "order" ? (
              <li key={`o-${e.order.id}`}>
                <OrderRow order={e.order} />
              </li>
            ) : (
              <li key={`m-${e.message.id}`}>
                <MessageRow message={e.message} isMine={e.isMine} />
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function OrderRow({ order }: { order: Order }) {
  const tone = orderTone(order.status);
  return (
    <Link
      href={`/orders/${order.id}`}
      className="block card p-4 hover:shadow-lg transition active:scale-[0.997]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`badge-${tone.badge}`}>{order.status}</span>
            <span className="text-xs text-ink-secondary mono">{order.order_number}</span>
          </div>
          <div className="font-medium">{tone.headline}</div>
          <div className="text-xs text-ink-secondary mt-1">
            {order.requested_delivery_date
              ? `Delivery ${dateShort(order.requested_delivery_date)}`
              : order.pickup_date
              ? `Pickup ${dateShort(order.pickup_date)}`
              : `Placed ${dateShort(order.created_at)}`}
          </div>
        </div>
        <div className="text-right">
          <div className="mono text-sm font-semibold">{money(order.total)}</div>
          <div className="text-xs text-ink-secondary">{relativeTime(order.created_at)}</div>
        </div>
      </div>
    </Link>
  );
}

function MessageRow({ message, isMine }: { message: Message; isMine: boolean }) {
  const isInbound = !isMine;
  return (
    <div className={`p-3 rounded-xl ${isInbound ? "bg-brand-blue-tint" : "bg-bg-secondary"} max-w-[88%] ${isMine ? "ml-auto" : ""}`}>
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="text-xs font-medium">
          {isMine ? "You" : "Fingerlakes Farms"}
          {message.channel === "sms" ? <span className="ml-1 text-ink-tertiary">· SMS</span> : null}
        </span>
        <span className="text-[10px] text-ink-secondary">{relativeTime(message.created_at)}</span>
      </div>
      <p className="text-sm whitespace-pre-wrap">{message.body}</p>
    </div>
  );
}

function orderTone(status: Order["status"]): { badge: string; headline: string } {
  switch (status) {
    case "draft":     return { badge: "gray",  headline: "Draft order" };
    case "pending":   return { badge: "gold",  headline: "Order received" };
    case "confirmed": return { badge: "blue",  headline: "Order confirmed" };
    case "processing":return { badge: "blue",  headline: "Being prepped" };
    case "ready":     return { badge: "green", headline: "Ready" };
    case "shipped":   return { badge: "green", headline: "Out for delivery" };
    case "delivered": return { badge: "green", headline: "Delivered" };
    case "cancelled": return { badge: "red",   headline: "Cancelled" };
  }
}
