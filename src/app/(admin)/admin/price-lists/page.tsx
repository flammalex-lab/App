import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import type { PriceList } from "@/lib/supabase/types";

export const metadata = { title: "Admin — Price lists" };

interface PriceListRow extends PriceList {
  itemCount: number;
  accountCount: number;
}

export default async function PriceListsPage() {
  await requireAdmin();
  const svc = createServiceClient();

  const [{ data: lists }, { data: items }, { data: accounts }] = await Promise.all([
    svc.from("price_lists").select("*").order("name", { ascending: true }),
    svc.from("price_list_items").select("price_list_id"),
    svc.from("accounts").select("price_list_id").not("price_list_id", "is", null),
  ]);

  const itemCounts = new Map<string, number>();
  for (const r of ((items as { price_list_id: string }[] | null) ?? [])) {
    itemCounts.set(r.price_list_id, (itemCounts.get(r.price_list_id) ?? 0) + 1);
  }
  const accountCounts = new Map<string, number>();
  for (const r of ((accounts as { price_list_id: string }[] | null) ?? [])) {
    accountCounts.set(r.price_list_id, (accountCounts.get(r.price_list_id) ?? 0) + 1);
  }

  const rows: PriceListRow[] = ((lists as PriceList[] | null) ?? []).map((l) => ({
    ...l,
    itemCount: itemCounts.get(l.id) ?? 0,
    accountCount: accountCounts.get(l.id) ?? 0,
  }));

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl">Price lists</h1>
          <p className="text-sm text-ink-secondary mt-1">
            Shared contract pricing assigned to one or more accounts. Per-account
            overrides (Pricing tab on an account) still win above this.
          </p>
        </div>
        <Link href="/admin/price-lists/new" className="btn-primary text-sm">
          New price list
        </Link>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-ink-secondary border-b border-black/5">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Items</th>
              <th className="p-3 text-right">Accounts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {rows.map((l) => (
              <tr key={l.id}>
                <td className="p-3">
                  <Link href={`/admin/price-lists/${l.id}`} className="underline">
                    {l.name}
                  </Link>
                  {l.description ? (
                    <span className="text-xs text-ink-secondary block">{l.description}</span>
                  ) : null}
                </td>
                <td className="p-3 text-xs">
                  {l.active ? <span className="badge-green">active</span> : <span className="badge-gray">inactive</span>}
                </td>
                <td className="p-3 text-right tabular">{l.itemCount}</td>
                <td className="p-3 text-right tabular">{l.accountCount}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-sm text-ink-secondary text-center">
                  No price lists yet. Create one and assign it to accounts that share the same contract.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
