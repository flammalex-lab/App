import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { relativeTime } from "@/lib/utils/format";

export const metadata = { title: "Admin — Messages" };

export default async function AdminMessagesPage() {
  const db = await createClient();
  // Latest message per account (naive: pull last 500 messages then dedupe)
  const { data: rows } = await db
    .from("messages")
    .select("*, account:accounts(name)")
    .order("created_at", { ascending: false })
    .limit(500);

  const latest: Record<string, any> = {};
  for (const m of (rows as any[] | null) ?? []) {
    if (!latest[m.account_id]) latest[m.account_id] = m;
  }
  const threads = Object.values(latest);

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl mb-4">Messages</h1>
      <div className="card divide-y divide-black/5">
        {threads.map((t: any) => (
          <Link key={t.account_id} href={`/admin/messages/${t.account_id}`} className="p-3 flex hover:bg-bg-secondary">
            <div className="flex-1 min-w-0">
              <div className="font-medium">{t.account?.name}</div>
              <div className="text-xs text-ink-secondary truncate">
                {t.direction === "inbound" ? "← " : "→ "}
                {t.body.slice(0, 120)}
              </div>
            </div>
            <div className="text-xs text-ink-secondary whitespace-nowrap ml-2">{relativeTime(t.created_at)}</div>
          </Link>
        ))}
        {!threads.length ? <div className="p-4 text-sm text-ink-secondary">No conversations yet.</div> : null}
      </div>
    </div>
  );
}
