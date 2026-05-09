"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountProduct, Product } from "@/lib/supabase/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

export function AccountVisibilityEditor({
  accountId,
  products,
  allowed,
}: {
  accountId: string;
  products: Product[];
  allowed: AccountProduct[];
}) {
  const router = useRouter();
  const toast = useToast();
  const initial = useMemo(() => new Set(allowed.map((a) => a.product_id)), [allowed]);
  const [selected, setSelected] = useState<Set<string>>(initial);
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.producer ?? "").toLowerCase().includes(q),
    );
  }, [products, filter]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/admin/accounts/${accountId}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: Array.from(selected) }),
    });
    setSaving(false);
    if (res.ok) {
      toast.push(`${selected.size} ${selected.size === 1 ? "product" : "products"} visible`, "success");
      router.refresh();
    } else {
      toast.push((await res.json()).error ?? "Save failed", "error");
    }
  }

  if (products.length === 0) {
    return (
      <div className="card p-5 text-sm text-ink-secondary">
        No private products yet. Mark a product as <strong>Private</strong> on its
        admin page to surface it here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Input
        type="search"
        placeholder="Search by name, SKU, or producer"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-ink-secondary border-b border-black/5">
            <tr>
              <th className="p-3 w-10"></th>
              <th className="p-3">Product</th>
              <th className="p-3">SKU</th>
              <th className="p-3">Producer</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {filtered.map((p) => (
              <tr key={p.id}>
                <td className="p-3 align-middle">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                </td>
                <td className="p-3">
                  {p.name}
                  {p.pack_size ? (
                    <span className="text-xs text-ink-secondary block">{p.pack_size}</span>
                  ) : null}
                </td>
                <td className="p-3 mono text-xs">{p.sku ?? "—"}</td>
                <td className="p-3 text-xs">{p.producer ?? "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-sm text-ink-secondary text-center">
                  No products match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="sticky bottom-4 flex gap-2 items-center">
        <Button onClick={save} loading={saving}>
          Save ({selected.size})
        </Button>
      </div>
    </div>
  );
}
