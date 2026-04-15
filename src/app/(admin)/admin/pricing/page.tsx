import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/utils/format";

export const metadata = { title: "Admin — Pricing" };

export default async function AdminPricingPage() {
  const db = await createClient();
  const { data: rows } = await db
    .from("account_pricing")
    .select("*, account:accounts(id,name), product:products(name, unit, pack_size)")
    .order("effective_date", { ascending: false })
    .limit(500);
  // Sort by account name client-side since PostgREST doesn't allow ORDER on joined column aliases reliably.
  const sorted = ((rows as any[]) ?? []).slice().sort((a, b) =>
    (a.account?.name ?? "").localeCompare(b.account?.name ?? ""),
  );

  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl mb-4">Account pricing overrides</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-ink-secondary border-b border-black/5">
            <tr>
              <th className="p-3">Account</th>
              <th className="p-3">Product</th>
              <th className="p-3">Custom price</th>
              <th className="p-3">Effective</th>
              <th className="p-3">Expires</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {sorted.map((r) => (
              <tr key={r.id}>
                <td className="p-3">
                  <Link href={`/admin/accounts/${r.account?.id}/pricing`} className="underline">
                    {r.account?.name}
                  </Link>
                </td>
                <td className="p-3">
                  {r.product?.name}
                  {r.product?.pack_size ? <span className="text-xs text-ink-secondary"> · {r.product.pack_size}</span> : null}
                </td>
                <td className="p-3 mono">{money(r.custom_price)} / {r.product?.unit}</td>
                <td className="p-3 text-xs">{r.effective_date}</td>
                <td className="p-3 text-xs">{r.expiry_date ?? "—"}</td>
              </tr>
            ))}
            {!sorted.length ? (
              <tr><td colSpan={5} className="p-4 text-sm text-ink-secondary">No account-specific pricing set.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-secondary mt-3">
        Set per-account pricing from the account&apos;s page → Pricing.
      </p>
    </div>
  );
}
