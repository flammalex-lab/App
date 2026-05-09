import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { relativeTime } from "@/lib/utils/format";

export const metadata = { title: "Admin — Messages" };

const PAGE_SIZE = 50;

interface ThreadRow {
  account_id: string;
  account_name: string;
  body: string;
  direction: string;
  created_at: string;
}

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(0, Number(sp.page ?? "0") || 0);

  const db = await createClient();
  // DB-side DISTINCT ON via the RPC added in migration 0020. The old
  // 500-message JS dedupe missed long-tail conversations once the table
  // grew past a couple hundred active accounts.
  const { data } = await db.rpc("latest_messages_per_account", {
    p_limit: PAGE_SIZE + 1, // fetch one extra to know if a next page exists
    p_offset: page * PAGE_SIZE,
  });
  const rows = ((data as ThreadRow[] | null) ?? []).slice(0, PAGE_SIZE);
  const hasNext = ((data as ThreadRow[] | null) ?? []).length > PAGE_SIZE;

  const pageHref = (n: number) =>
    n === 0 ? "/admin/messages" : `/admin/messages?page=${n}`;

  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl mb-4">Messages</h1>
      <div className="card divide-y divide-black/5">
        {rows.map((t) => (
          <Link
            key={t.account_id}
            href={`/admin/messages/${t.account_id}`}
            className="p-3 flex hover:bg-bg-secondary"
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium">{t.account_name}</div>
              <div className="text-xs text-ink-secondary truncate">
                {t.direction === "inbound" ? "← " : "→ "}
                {(t.body ?? "").slice(0, 120)}
              </div>
            </div>
            <div className="text-xs text-ink-secondary whitespace-nowrap ml-2">
              {relativeTime(t.created_at)}
            </div>
          </Link>
        ))}
        {!rows.length ? (
          <div className="p-4 text-sm text-ink-secondary">No conversations yet.</div>
        ) : null}
      </div>
      {(page > 0 || hasNext) ? (
        <div className="mt-4 flex justify-end gap-2 text-sm">
          {page > 0 ? (
            <Link href={pageHref(page - 1)} className="px-3 py-1 rounded border border-black/10 bg-white hover:bg-bg-secondary">
              ← Prev
            </Link>
          ) : null}
          {hasNext ? (
            <Link href={pageHref(page + 1)} className="px-3 py-1 rounded border border-black/10 bg-white hover:bg-bg-secondary">
              Next →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
