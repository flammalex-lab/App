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
      <h1 className="text-3xl mb-4">Standing orders</h1>
      <div className="card divide-y divide-black/5">
        {((data as (StandingOrder & { account: { name: string } })[]) ?? []).map((s) => (
          <div key={s.id} className="p-3 flex items-center justify-between">
            <div>
              <div className="font-medium">{s.account?.name}</div>
              <div className="text-xs text-ink-secondary">
                {s.frequency} · {s.days_of_week.join(", ")}
                {s.next_run_date ? ` · next ${dateShort(s.next_run_date)}` : ""}
              </div>
            </div>
            <span className={s.active ? "badge-green" : "badge-gray"}>{s.active ? "active" : "off"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
