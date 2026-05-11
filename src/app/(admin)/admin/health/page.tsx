import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import type { Account, Product } from "@/lib/supabase/types";

export const metadata = { title: "Admin — Pre-launch checks" };

/**
 * Catches the two gaps that the new server-side order-create checks will
 * surface as 400s once buyers start placing orders:
 *   1. Active B2B-visible products with no usable wholesale_price
 *      (`resolvePrice` returns null on null OR zero/negative, so the
 *      health check has to match that — checking IS NULL alone misses
 *      every row that was hand-entered as 0).
 *   2. Active accounts with no delivery_zone (silently get $0 delivery —
 *      may be intentional for pickup-only buyers, but worth confirming).
 *
 * Caveat: products that price exclusively via pack_options will appear
 * as "needs price" here even if pack-based pricing works elsewhere; the
 * order-create endpoint uses resolvePrice() which only looks at
 * wholesale_price + account_pricing overrides.
 */
export default async function HealthPage() {
  await requireAdmin();
  const db = createServiceClient();

  const [unpricedRes, noZoneRes] = await Promise.all([
    db
      .from("products")
      .select("id, name, sku, brand, category, available_b2b, available_dtc, wholesale_price")
      .or("wholesale_price.is.null,wholesale_price.lte.0")
      .eq("is_active", true)
      .order("name"),
    db
      .from("accounts")
      .select("id, name, channel, type, primary_contact_name, primary_contact_phone")
      .is("delivery_zone", null)
      .eq("status", "active")
      .order("name"),
  ]);

  const unpriced = (unpricedRes.data as Product[] | null) ?? [];
  const noZone = (noZoneRes.data as Account[] | null) ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl">Pre-launch checks</h1>
        <p className="text-sm text-ink-secondary mt-1">
          Two gaps that will block real orders now that pricing is enforced server-side.
          Sweep both lists before inviting customers.
        </p>
      </div>

      <section className="card mb-6">
        <div className="p-4 border-b border-black/5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">Products without usable wholesale price</h2>
            <p className="text-xs text-ink-secondary mt-0.5">
              Active products with <code>wholesale_price</code> null or zero.
              A B2B order containing one will be rejected at checkout with a
              pricing-not-configured error.
            </p>
          </div>
          <span className="badge-gray">{unpriced.length}</span>
        </div>
        {unpriced.length === 0 ? (
          <div className="p-6 text-sm text-ink-secondary">All active products have a wholesale price set.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-ink-secondary border-b border-black/5">
                <tr>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Brand</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">B2B</th>
                  <th className="p-3">DTC</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {unpriced.map((p) => (
                  <tr key={p.id} className="border-b border-black/5">
                    <td className="p-3 font-mono text-xs">{p.sku ?? "—"}</td>
                    <td className="p-3">{p.name}</td>
                    <td className="p-3">{p.brand}</td>
                    <td className="p-3">{p.category}</td>
                    <td className="p-3">{p.available_b2b ? "✓" : "—"}</td>
                    <td className="p-3">{p.available_dtc ? "✓" : "—"}</td>
                    <td className="p-3 text-right">
                      <Link href={`/admin/products/${p.id}`} className="text-sm underline">
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="p-4 border-b border-black/5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">Active accounts without delivery zone</h2>
            <p className="text-xs text-ink-secondary mt-0.5">
              These accounts will be charged $0 delivery on every order. Fine for pickup-only
              buyers; otherwise set a zone.
            </p>
          </div>
          <span className="badge-gray">{noZone.length}</span>
        </div>
        {noZone.length === 0 ? (
          <div className="p-6 text-sm text-ink-secondary">Every active account has a delivery zone set.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-ink-secondary border-b border-black/5">
                <tr>
                  <th className="p-3">Account</th>
                  <th className="p-3">Channel</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {noZone.map((a) => (
                  <tr key={a.id} className="border-b border-black/5">
                    <td className="p-3">{a.name}</td>
                    <td className="p-3">{a.channel}</td>
                    <td className="p-3">{a.type}</td>
                    <td className="p-3">{a.primary_contact_name ?? "—"}</td>
                    <td className="p-3 font-mono text-xs">{a.primary_contact_phone ?? "—"}</td>
                    <td className="p-3 text-right">
                      <Link href={`/admin/accounts/${a.id}`} className="text-sm underline">
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
