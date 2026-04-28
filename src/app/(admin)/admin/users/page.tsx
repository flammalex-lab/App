import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";
import { UserToolsRow } from "./UserToolsRow";

export const metadata = { title: "Users — Admin" };

interface UserRow extends Profile {
  account_name: string | null;
  /** Email pulled from auth.users when profiles.email is null. */
  authEmail: string | null;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const svc = createServiceClient();

  let users: UserRow[] = [];

  if (q) {
    const needle = q.toLowerCase();
    const like = `%${q}%`;

    // 1. Pull auth.users via the admin API and filter by email locally —
    //    profiles.email is nullable and often empty, so a search that
    //    only queries profiles misses everyone whose email lives only
    //    in auth. Capped at 1000 (one page), which is plenty for now.
    const { data: authPage } = await svc.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const authUsers = (authPage as { users?: Array<{ id: string; email?: string | null; phone?: string | null; created_at: string }> } | null)?.users ?? [];
    const authMatches = authUsers.filter((u) =>
      (u.email ?? "").toLowerCase().includes(needle),
    );
    const authMatchIds = new Set(authMatches.map((u) => u.id));
    const emailById = new Map<string, string | null>(
      authMatches.map((u) => [u.id, u.email ?? null]),
    );

    // 2. Profiles query — match by email/first/last (in case profiles.email
    //    IS populated) AND include any IDs we found in step 1.
    const idList = Array.from(authMatchIds);
    const { data: profileRows } = await svc
      .from("profiles")
      .select("*, account:accounts(name)")
      .or(
        [
          `email.ilike.${like}`,
          `first_name.ilike.${like}`,
          `last_name.ilike.${like}`,
          idList.length ? `id.in.(${idList.join(",")})` : null,
        ]
          .filter(Boolean)
          .join(","),
      )
      .order("created_at", { ascending: false })
      .limit(50);

    // 3. Merge auth-only matches that don't yet have a profile row, just
    //    so admin can still see they exist.
    const profileIds = new Set(((profileRows as any[] | null) ?? []).map((p) => p.id));
    users = ((profileRows as any[] | null) ?? []).map((p) => ({
      ...(p as Profile),
      account_name: p.account?.name ?? null,
      authEmail: emailById.get(p.id) ?? null,
    }));
    for (const u of authMatches) {
      if (profileIds.has(u.id)) continue;
      users.push({
        id: u.id,
        first_name: null,
        last_name: null,
        email: u.email ?? null,
        phone: u.phone ?? null,
        role: "—",
        account_id: null,
        buyer_type: null,
        account_name: null,
        authEmail: u.email ?? null,
      } as unknown as UserRow);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="display text-3xl mb-1">Users</h1>
      <p className="text-sm text-ink-secondary mb-5">
        Search any account (admin, B2B buyer, DTC customer) by email or name.
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
          const email = u.email ?? u.authEmail;
          return (
            <div key={u.id} className="card p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="font-semibold text-[15px] truncate">{name}</div>
                  <div className="text-[13px] text-ink-secondary truncate">
                    {email ?? u.phone ?? "—"}
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
              <UserToolsRow profileId={u.id} hasEmail={Boolean(email)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
