import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { StandingOrder, Account } from "@/lib/supabase/types";
import { dateShort } from "@/lib/utils/format";

export const metadata = { title: "Admin — Standing orders" };

export default async function AdminStandingPage() {
  const db = await createClient();
  const { data } = await db
    .from("standing_orders")
    .select("*, account:accounts(name)")
    .order("next_run_date", { ascending: true });

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl">Standing orders</h1>
        <Link href="/admin/standing/new" className="btn-primary text-sm">New</Link>
      </div>
      <div className="card divide-y divide-black/5">
        {((data as (StandingOrder & { account: { name: string } })[]) ?? []).map((s) => (
          <Link key={s.id} href={`/admin/standing/${s.id}`} className="p-3 flex items-center justify-between hover:bg-bg-secondary">
            <div>
              {/* Surface both the user-chosen name and the account so
                  multiple standing orders on one account stay
                  distinguishable in the list. */}
              <div className="font-medium">
                {s.name || s.account?.name || "Untitled"}
                {s.name && s.account?.name ? (
                  <span className="text-ink-tertiary font-normal text-xs ml-2">
                    · {s.account.name}
                  </span>
                ) : null}
              </div>
              <div className="text-xs text-ink-secondary">
                {s.frequency} · {s.days_of_week.join(", ")}
                {s.next_run_date ? ` · next ${dateShort(s.next_run_date)}` : ""}
              </div>
            </div>
            {(() => {
              const paused = Boolean(s.pause_until) && new Date(s.pause_until!) > new Date();
              if (paused) return <span className="badge-gold">paused</span>;
              return (
                <span className={s.active ? "badge-green" : "badge-gray"}>
                  {s.active ? "active" : "off"}
                </span>
              );
            })()}
          </Link>
        ))}
        {!((data as any[]) ?? []).length ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-ink-primary mb-1">
              No standing orders yet
            </p>
            <p className="text-xs text-ink-secondary mb-4 max-w-sm mx-auto leading-snug">
              Standing orders auto-create a draft on a recurring schedule.
              Configure one for any buyer who reorders the same items every
              week.
            </p>
            <Link href="/admin/standing/new" className="btn-primary text-sm">
              Create a standing order
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
