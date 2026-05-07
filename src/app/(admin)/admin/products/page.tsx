import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/supabase/types";
import { money } from "@/lib/utils/format";
import { BRAND_LABELS, CATEGORY_LABELS } from "@/lib/constants";

export const metadata = { title: "Admin — Products" };

export default async function AdminProductsPage() {
  const db = await createClient();
  const { data } = await db.from("products").select("*").order("sort_order");
  const products = (data as Product[] | null) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl">Products</h1>
        <Link href="/admin/products/new" className="btn-primary text-sm">New product</Link>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-ink-secondary border-b border-black/5">
            <tr>
              <th className="p-3">SKU</th>
              <th className="p-3">Name</th>
              <th className="p-3">Brand</th>
              <th className="p-3">Category</th>
              <th className="p-3">Wholesale</th>
              <th className="p-3">Retail</th>
              <th className="p-3">Avail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-bg-secondary">
                <td className="p-3 mono text-xs">{p.sku ?? "—"}</td>
                <td className="p-3">
                  <Link href={`/admin/products/${p.id}`} className="underline">{p.name}</Link>
                  {p.pack_size ? <div className="text-xs text-ink-secondary">{p.pack_size}</div> : null}
                </td>
                <td className="p-3">{BRAND_LABELS[p.brand]}</td>
                <td className="p-3">{CATEGORY_LABELS[p.category]}</td>
                <td className="p-3 mono">{money(p.wholesale_price)}</td>
                <td className="p-3 mono">{money(p.retail_price)}</td>
                <td className="p-3 text-xs">
                  {p.is_active ? <span className="badge-green">active</span> : <span className="badge-gray">off</span>}
                  {!p.available_this_week ? <span className="badge-gray ml-1">week off</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
