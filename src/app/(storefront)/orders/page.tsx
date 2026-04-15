import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import type { Order } from "@/lib/supabase/types";
import { StatusBadge } from "@/components/ui/Badge";
import { dateShort, money } from "@/lib/utils/format";

export const metadata = { title: "Orders — Fingerlakes Farms" };

export default async function OrdersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const impersonating = session.profile.role === "admin" ? getImpersonation() : null;
  const db = impersonating ? createServiceClient() : await createClient();
  const profileId = impersonating ?? session.userId;

  const { data } = await db
    .from("orders")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });
  const orders = (data as Order[] | null) ?? [];

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl mb-4">Orders</h1>
      {orders.length === 0 ? (
        <p className="text-ink-secondary">You haven&apos;t placed any orders yet.</p>
      ) : (
        <div className="card divide-y divide-black/5">
          {orders.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`} className="flex items-center p-4 hover:bg-bg-secondary">
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
