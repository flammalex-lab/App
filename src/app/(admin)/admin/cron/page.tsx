import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import type { CronRun } from "@/lib/supabase/types";
import { Chip } from "@/components/ui/Badge";
import { relativeTime } from "@/lib/utils/format";

export const metadata = { title: "Admin — Cron runs" };

/**
 * Last 7 days of `/api/cron/*` invocations. Each route inserts a row on
 * entry and updates it on completion; errored rows surface the exception
 * message so a silent retry loop doesn't go unnoticed for days.
 *
 * RLS-bypass pattern: requireAdmin() gates the route, then we read with
 * the service client because the `cron_runs admin read` policy only
 * resolves for callers whose JWT carries the admin role — which the
 * service client doesn't carry. Same approach as /admin/health.
 */
export default async function CronPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const filter = sp.job?.trim() || null;
  const db = createServiceClient();

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  let query = db
    .from("cron_runs")
    .select("*")
    .gte("started_at", sevenDaysAgo)
    .order("started_at", { ascending: false })
    .limit(500);
  if (filter) query = query.eq("job", filter);
  const { data } = await query;
  const runs = (data as CronRun[] | null) ?? [];

  // Job list for the filter chips — pulled from the full window so filter
  // chips don't disappear when you click into one. Cheap because indexed.
  const { data: jobsData } = await db
    .from("cron_runs")
    .select("job")
    .gte("started_at", sevenDaysAgo);
  const jobs = Array.from(new Set(((jobsData as { job: string }[] | null) ?? []).map((r) => r.job))).sort();

  const erroredCount = runs.filter((r) => r.status === "errored").length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl">Cron runs</h1>
        <p className="text-sm text-ink-secondary mt-1">
          Last 7 days of <code>/api/cron/*</code> invocations.{" "}
          {erroredCount > 0 ? (
            <span className="text-accent-rust">{erroredCount} errored</span>
          ) : (
            <span>No failures.</span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 text-sm">
        <Tag href="/admin/cron" active={!filter}>All</Tag>
        {jobs.map((j) => (
          <Tag key={j} href={`/admin/cron?job=${encodeURIComponent(j)}`} active={filter === j}>
            {j}
          </Tag>
        ))}
      </div>

      <div className="card overflow-x-auto">
        {runs.length === 0 ? (
          <div className="p-6 text-sm text-ink-secondary">
            {filter ? `No runs of ${filter} in the last 7 days.` : "No cron runs in the last 7 days."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-secondary border-b border-black/5">
              <tr>
                <th className="p-3">Job</th>
                <th className="p-3">Status</th>
                <th className="p-3">Started</th>
                <th className="p-3">Duration</th>
                <th className="p-3 text-right">Rows</th>
                <th className="p-3">Error</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b border-black/5 align-top">
                  <td className="p-3 font-mono text-xs">{r.job}</td>
                  <td className="p-3">
                    {r.status === "ok" ? (
                      <Chip tone="green">ok</Chip>
                    ) : (
                      <Chip tone="red">errored</Chip>
                    )}
                  </td>
                  <td className="p-3 text-xs whitespace-nowrap">
                    {relativeTime(r.started_at)}
                  </td>
                  <td className="p-3 text-xs whitespace-nowrap">{durationMs(r)}</td>
                  <td className="p-3 mono text-xs text-right">
                    {r.rows_affected ?? "—"}
                  </td>
                  <td className="p-3 text-xs text-accent-rust max-w-[40ch] break-words">
                    {r.error ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function durationMs(r: CronRun): string {
  if (!r.finished_at) return r.status === "errored" ? "—" : "(running)";
  const ms = new Date(r.finished_at).getTime() - new Date(r.started_at).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 1000)}s`;
}

function Tag({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1 rounded-full border ${active ? "bg-brand-green text-white border-brand-green" : "bg-white border-black/10"}`}
    >
      {children}
    </Link>
  );
}
