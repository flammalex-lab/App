import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";
import { UserToolsRow } from "./UserToolsRow";

export const metadata = { title: "Users — Admin" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const svc = createServiceClient();

  let users: (Profile & { account_name: string | null })[] = [];

  if (q) {
    // Match against email or name across ALL profile types — admin search
    // covers admins, b2b buyers, and DTC customers in one place.
    const like = `%${q}%`;
    const { data } = await svc
      .from("profiles")
      .select("*, account:accounts(name)")
      .or(`email.ilike.${like},first_name.ilike.${like},last_name.ilike.${like}`)
      .order("created_at", { ascending: false })
      .limit(20);
    users = ((data as any[] | null) ?? []).map((u) => ({
      ...(u as Profile),
      account_name: u.account?.name ?? null,
    }));
  }

  return (
    <div className="max-w-3xl">
      <h1 className="display text-3xl mb-1">Users</h1>
      <p className="text-sm text-ink-secondary mb-5">
        Search any profile (admin, B2B buyer, DTC customer) by email or name.
        Use the inline tools to set a password or generate a sign-in link
        without leaving the page.
      </p>

      <form action="/admin/users" className="flex gap-2 mb-5">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search email, first name, last name…"
          autoFocus
          className="input flex-1"
          type="search"
        />
        <button className="btn-primary text-sm">Search</button>
      </form>

      {q && users.length === 0 ? (
        <div className="card p-6 text-center text-sm text-ink-secondary">
          No users match &ldquo;{q}&rdquo;.
        </div>
      ) : null}

      {!q ? (
        <div className="card p-6 text-center text-sm text-ink-secondary">
          Enter a search above to find a user.
        </div>
      ) : null}

      <div className="space-y-3">
        {users.map((u) => {
          const name = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "—";
          return (
            <div key={u.id} className="card p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="font-semibold text-[15px] truncate">{name}</div>
                  <div className="text-[13px] text-ink-secondary truncate">
                    {u.email ?? u.phone ?? "—"}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="badge badge-gray">{u.role}</span>
                    {u.account_name ? (
                      <span className="text-ink-tertiary">· {u.account_name}</span>
                    ) : null}
                  </div>
                </div>
                {u.account_id ? (
                  <Link
                    href={`/admin/accounts/${u.account_id}/buyers/${u.id}`}
                    className="text-[13px] text-brand-blue hover:underline shrink-0"
                  >
                    Open profile →
                  </Link>
                ) : null}
              </div>
              <UserToolsRow profileId={u.id} hasEmail={Boolean(u.email)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
