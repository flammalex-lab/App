import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import type { StandingOrder, StandingOrderItem, Product } from "@/lib/supabase/types";
import { dateShort } from "@/lib/utils/format";

export const metadata = { title: "Standing orders — Fingerlakes Farms" };

export default async function StandingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const impersonating = session.profile.role === "admin" ? getImpersonation() : null;
  const db = impersonating ? createServiceClient() : await createClient();
  const profileId = impersonating ?? session.userId;

  const { data } = await db.from("standing_orders").select("*").eq("profile_id", profileId).order("created_at");
  const orders = (data as StandingOrder[] | null) ?? [];

  const itemsByOrder: Record<string, (StandingOrderItem & { product: Product })[]> = {};
  if (orders.length) {
    const { data: itemRows } = await db
      .from("standing_order_items")
      .select("*, product:products(*)")
      .in("standing_order_id", orders.map((o) => o.id));
    for (const row of (itemRows ?? []) as (StandingOrderItem & { product: Product })[]) {
      (itemsByOrder[row.standing_order_id] ??= []).push(row);
    }
  }

  return (
    <div className="max-w-screen-xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl">Standing orders</h1>
        <Link href="/standing/new" className="btn-primary text-sm">New</Link>
      </div>
      {orders.length === 0 ? (
        <p className="text-ink-secondary">
          No recurring orders yet. Set one up to auto-send your usual on specific days — we&apos;ll text
          you to confirm before it submits.
        </p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="card p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium">{o.name ?? "Standing order"}</div>
                  <div className="text-xs text-ink-secondary">
                    {o.frequency} · {o.days_of_week.join(", ")}
                    {o.next_run_date ? ` · next ${dateShort(o.next_run_date)}` : ""}
                  </div>
                </div>
                <span className={o.active ? "badge-green" : "badge-gray"}>
                  {o.active ? "active" : o.pause_until ? "paused" : "off"}
                </span>
              </div>
              <ul className="mt-3 text-sm space-y-1">
                {(itemsByOrder[o.id] ?? []).map((i) => (
                  <li key={i.id} className="flex justify-between">
                    <span>{i.product.name} {i.product.pack_size ? `(${i.product.pack_size})` : ""}</span>
                    <span className="mono">{i.quantity} {i.product.unit}</span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 mt-3">
                <form action={`/api/standing/${o.id}/toggle`} method="post">
                  <button className="btn-ghost text-sm">{o.active ? "Pause" : "Resume"}</button>
                </form>
                <form action={`/api/standing/${o.id}/run-now`} method="post">
                  <button className="btn-secondary text-sm">Run now</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
