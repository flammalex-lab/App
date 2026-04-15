import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Account, Profile, Order, Activity, StandingOrder, Category, DeliveryZone } from "@/lib/supabase/types";
import { AccountForm } from "./AccountForm";
import Link from "next/link";
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

  const [{ data: buyers }, { data: orders }, { data: activities }, { data: standing }] = await Promise.all([
    db.from("profiles").select("*").eq("account_id", id),
    db.from("orders").select("*").eq("account_id", id).order("created_at", { ascending: false }).limit(25),
    db.from("activities").select("*").eq("account_id", id).order("created_at", { ascending: false }).limit(25),
    db.from("standing_orders").select("*").eq("account_id", id),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl">{(account as Account).name}</h1>
        <p className="text-ink-secondary text-sm">{(account as Account).status}</p>
      </div>
      <AccountForm account={account as Account} />

      <section>
        <h2 className="font-serif text-xl mb-2">Buyers</h2>
        <div className="card divide-y divide-black/5">
          {((buyers as Profile[] | null) ?? []).map((b) => (
            <div key={b.id} className="p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{b.first_name} {b.last_name}</div>
                <div className="text-xs text-ink-secondary">{b.email ?? b.phone}</div>
              </div>
              <form action={`/api/admin/impersonate/start?profileId=${b.id}`} method="post">
                <button className="btn-secondary text-sm">View as buyer</button>
              </form>
            </div>
          ))}
          {!(buyers as Profile[] | null)?.length ? (
            <div className="p-4 text-sm text-ink-secondary">No buyers yet. Invite one from the account form.</div>
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
                <div className="text-xs text-ink-secondary">{dateShort(o.created_at)} · {o.status}</div>
              </div>
              <div className="mono text-sm">{money(o.total)}</div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-serif text-xl mb-2">Standing orders</h2>
        <div className="card">
          {((standing as StandingOrder[] | null) ?? []).map((s) => (
            <div key={s.id} className="p-3 text-sm flex justify-between">
              <span>{s.name ?? "Standing order"} · {s.frequency} · {s.days_of_week.join(", ")}</span>
              <span>{s.active ? "active" : "off"}</span>
            </div>
          ))}
          {!(standing as StandingOrder[] | null)?.length ? (
            <div className="p-4 text-sm text-ink-secondary">No standing orders.</div>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="font-serif text-xl mb-2">Activity log</h2>
        <div className="card divide-y divide-black/5">
          {((activities as Activity[] | null) ?? []).map((a) => (
            <div key={a.id} className="p-3 text-sm">
              <div className="flex justify-between">
                <span><span className="badge-gray">{a.type}</span> {a.subject}</span>
                <span className="text-xs text-ink-secondary">{dateShort(a.created_at)}</span>
              </div>
              {a.body ? <div className="text-xs text-ink-secondary mt-1">{a.body}</div> : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

type Activity = { id: string; type: string; subject: string | null; body: string | null; created_at: string };
