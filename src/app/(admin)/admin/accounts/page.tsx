import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Account } from "@/lib/supabase/types";
import { ZONE_LABELS } from "@/lib/constants";

export const metadata = { title: "Admin — Accounts" };

export default async function AdminAccountsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const db = await createClient();
  let query = db.from("accounts").select("*").order("name");
  if (sp.status) query = query.eq("status", sp.status);
  const { data } = await query;
  const accounts = (data as Account[] | null) ?? [];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl">Accounts</h1>
        <Link href="/admin/accounts/new" className="btn-primary text-sm">New account</Link>
      </div>
      <div className="flex gap-2 mb-4 text-sm">
        <Link href="/admin/accounts" className={`btn-ghost ${!sp.status ? "bg-bg-secondary" : ""}`}>All</Link>
        {["prospect", "active", "inactive", "churned"].map((s) => (
          <Link key={s} href={`/admin/accounts?status=${s}`} className={`btn-ghost ${sp.status === s ? "bg-bg-secondary" : ""}`}>{s}</Link>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-ink-secondary border-b border-black/5">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Status</th>
              <th className="p-3">Tier</th>
              <th className="p-3">Zone</th>
              <th className="p-3">QB</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {accounts.map((a) => (
              <tr key={a.id} className="hover:bg-bg-secondary">
                <td className="p-3">
                  <Link href={`/admin/accounts/${a.id}`} className="underline">{a.name}</Link>
                  <div className="text-xs text-ink-secondary">{a.type} · {a.channel}</div>
                </td>
                <td className="p-3"><span className="badge-gray">{a.status}</span></td>
                <td className="p-3">{a.pricing_tier}</td>
                <td className="p-3 text-xs">{a.delivery_zone ? ZONE_LABELS[a.delivery_zone] : "—"}</td>
                <td className="p-3 text-xs">{a.qb_customer_name ?? <span className="text-feedback-error">unmapped</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
