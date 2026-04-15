import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Account, Activity, Order, Profile, StandingOrder } from "@/lib/supabase/types";
import { AccountForm } from "./AccountForm";
import { ActivityLogForm } from "./ActivityLogForm";
import { dateShort, money } from "@/lib/utils/format";

export default async function AdminAccountDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();

  if (id === "new") {
    return (
      <div className="max-w-3xl">
        <h1 className="text-3xl mb-4">New account</h1>
        <AccountForm account={null} />
      </div>
    );
  }

  const { data: account } = await db.from("accounts").select("*").eq("id", id).maybeSingle();
  if (!account) notFound();

  const [{ data: buyers }, { data: orders }, { data: activities }, { data: standing }, overrideCount] =
    await Promise.all([
      db.from("profiles").select("*").eq("account_id", id),
      db.from("orders").select("*").eq("account_id", id).order("created_at", { ascending: false }).limit(25),
      db.from("activities").select("*").eq("account_id", id).order("created_at", { ascending: false }).limit(25),
      db.from("standing_orders").select("*").eq("account_id", id),
      db.from("account_pricing").select("id", { count: "exact", head: true }).eq("account_id", id),
    ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl">{(account as Account).name}</h1>
          <p className="text-ink-secondary text-sm">{(account as Account).status}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/accounts/${id}/pricing`} className="btn-ghost text-sm">
            Pricing ({overrideCount.count ?? 0})
          </Link>
        </div>
      </div>

      <AccountForm account={account as Account} />

      <section>
        <h2 className="font-serif text-xl mb-2">Buyers</h2>
        <div className="card divide-y divide-black/5">
          {((buyers as Profile[] | null) ?? []).map((b) => (
            <div key={b.id} className="p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">
                  {b.first_name} {b.last_name}
                </div>
                <div className="text-xs text-ink-secondary">{b.email ?? b.phone}</div>
              </div>
              <div className="flex gap-2">
                <Link href={`/admin/accounts/${id}/guide/${b.id}`} className="btn-ghost text-sm">
                  Edit guide
                </Link>
                <form action={`/api/admin/impersonate/start?profileId=${b.id}`} method="post">
                  <button className="btn-secondary text-sm">View as buyer</button>
                </form>
              </div>
            </div>
          ))}
          {!(buyers as Profile[] | null)?.length ? (
            <div className="p-4 text-sm text-ink-secondary">
              No buyers yet. Invite one from the account form.
            </div>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="font-serif text-xl mb-2">Recent orders</h2>
        <div className="card divide-y divide-black/5">
          {((orders as Order[] | null) ?? []).map((o) => (
            <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex p-3 hover:bg-bg-secondary">
              <div className="flex-1">
                <span className="mono font-medium">{o.order_number}</span>
                <div className="text-xs text-ink-secondary">
                  {dateShort(o.created_at)} · {o.status}
                </div>
              </div>
              <div className="mono text-sm">{money(o.total)}</div>
            </Link>
          ))}
          {!((orders as Order[] | null) ?? []).length ? (
            <div className="p-4 text-sm text-ink-secondary">No orders yet.</div>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="font-serif text-xl mb-2">Standing orders</h2>
        <div className="card">
          {((standing as StandingOrder[] | null) ?? []).map((s) => (
            <Link key={s.id} href={`/admin/standing/${s.id}`} className="p-3 text-sm flex justify-between hover:bg-bg-secondary">
              <span>
                {s.name ?? "Standing order"} · {s.frequency} · {s.days_of_week.join(", ")}
              </span>
              <span>{s.active ? "active" : "off"}</span>
            </Link>
          ))}
          {!(standing as StandingOrder[] | null)?.length ? (
            <div className="p-4 text-sm text-ink-secondary">No standing orders.</div>
          ) : null}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-serif text-xl">Activity log</h2>
        </div>
        <ActivityLogForm accountId={id} />
        <div className="card divide-y divide-black/5 mt-2">
          {((activities as Activity[] | null) ?? []).map((a) => (
            <div key={a.id} className="p-3 text-sm">
              <div className="flex justify-between">
                <span>
                  <span className="badge-gray">{a.type}</span> {a.subject}
                </span>
                <span className="text-xs text-ink-secondary">{dateShort(a.created_at)}</span>
              </div>
              {a.body ? <div className="text-xs text-ink-secondary mt-1">{a.body}</div> : null}
              {a.follow_up_date ? (
                <div className="text-xs text-accent-gold mt-1">
                  follow up {dateShort(a.follow_up_date)}
                </div>
              ) : null}
            </div>
          ))}
          {!((activities as Activity[] | null) ?? []).length ? (
            <div className="p-4 text-sm text-ink-secondary">No activity logged.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
