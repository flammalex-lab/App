import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getImpersonation } from "@/lib/auth/impersonation";
import type { Account } from "@/lib/supabase/types";
import { prettyPhone } from "@/lib/utils/phone";

export const metadata = { title: "Account — Fingerlakes Farms" };

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const impersonating = session.profile.role === "admin" ? getImpersonation() : null;
  const db = impersonating ? createServiceClient() : await createClient();
  const profileId = impersonating ?? session.userId;

  const { data: profile } = await db.from("profiles").select("*").eq("id", profileId).maybeSingle();
  if (!profile) redirect("/login");
  const { data: acctRow } = profile.account_id
    ? await db.from("accounts").select("*").eq("id", profile.account_id).maybeSingle()
    : { data: null as Account | null };
  const account = acctRow as Account | null;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="display text-3xl mb-4">Account</h1>
      <div className="card p-5 space-y-2">
        <Row label="Name" value={`${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim()} />
        {profile.title ? <Row label="Title" value={profile.title} /> : null}
        <Row label="Email" value={profile.email ?? "—"} />
        <Row label="Phone" value={prettyPhone(profile.phone)} />
      </div>
      {account ? (
        <div className="card p-5 mt-4 space-y-2">
          <h2 className="font-serif text-lg mb-1">{account.name}</h2>
          {account.delivery_day ? (
            <Row label="Delivery days" value={account.delivery_day} />
          ) : null}
          {account.order_minimum ? (
            <Row label="Minimum" value={`$${Number(account.order_minimum).toFixed(2)}`} />
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 flex gap-2">
        <a href="/standing" className="btn-ghost text-sm">Standing orders</a>
        <a href="/messages" className="btn-ghost text-sm">Messages thread</a>
      </div>

      <form action="/auth/signout" method="post" className="mt-8">
        <button className="btn-secondary w-full">Sign out</button>
      </form>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-ink-secondary">{label}</span>
      <span>{value}</span>
    </div>
  );
}
