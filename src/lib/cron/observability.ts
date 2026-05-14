import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Wrap a cron handler so every invocation lands in `cron_runs`:
 *   - inserts a row on entry with status='ok'
 *   - on success, updates finished_at + rows_affected
 *   - on thrown error, flips status to 'errored' and stashes the message
 *
 * The handler receives a `setRowsAffected` callback so each route can
 * report the count of work units it actually processed (notifications
 * sent, standing orders run, etc.). Errors are re-thrown after recording
 * so the Next.js error boundary / Vercel logs still surface them.
 */
export async function recordCronRun<T>(
  svc: SupabaseClient,
  job: string,
  fn: (ctx: { setRowsAffected: (n: number) => void }) => Promise<T>,
): Promise<T> {
  let rowsAffected: number | null = null;
  const { data: inserted, error: insertErr } = await svc
    .from("cron_runs")
    .insert({ job, status: "ok" })
    .select("id")
    .single();
  if (insertErr) {
    // Without a runId we lose all observability for this invocation. Log it
    // loudly so it shows up in Vercel logs even when the schema is missing
    // (e.g. migration 0031 not yet applied).
    console.error(
      `[cron] failed to insert cron_runs row for job="${job}" — observability will be degraded:`,
      insertErr,
    );
    // In dev, fail fast so the missing migration / schema mismatch is
    // impossible to ignore. In prod, degrade gracefully — running with no
    // observability beats not running at all.
    if (process.env.NODE_ENV === "development") {
      throw new Error(
        `cron_runs insert failed for job="${job}": ${insertErr.message ?? String(insertErr)}. ` +
          `Did migration 0031_cron_runs.sql get applied?`,
      );
    }
  }
  const runId = (inserted as { id: string } | null)?.id ?? null;

  try {
    const result = await fn({
      setRowsAffected: (n: number) => {
        rowsAffected = n;
      },
    });
    if (runId) {
      await svc
        .from("cron_runs")
        .update({
          finished_at: new Date().toISOString(),
          rows_affected: rowsAffected,
        })
        .eq("id", runId);
    }
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (runId) {
      await svc
        .from("cron_runs")
        .update({
          status: "errored",
          finished_at: new Date().toISOString(),
          rows_affected: rowsAffected,
          error: message.slice(0, 2000),
        })
        .eq("id", runId);
    }
    throw err;
  }
}
