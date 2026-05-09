"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Account, PriceList, PriceListItem, Product } from "@/lib/supabase/types";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { money } from "@/lib/utils/format";

export function PriceListEditor({
  list,
  items,
  accountsUsing,
  products,
}: {
  list: PriceList | null;
  items: PriceListItem[];
  accountsUsing: Pick<Account, "id" | "name">[];
  products: Product[];
}) {
  const router = useRouter();
  const toast = useToast();

  const [meta, setMeta] = useState({
    name: list?.name ?? "",
    description: list?.description ?? "",
    active: list?.active ?? true,
  });
  const initialPrices = useMemo(() => {
    const m: Record<string, string> = {};
    for (const it of items) m[it.product_id] = String(it.unit_price);
    return m;
  }, [items]);
  const [prices, setPrices] = useState<Record<string, string>>(initialPrices);
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

  async function save() {
    if (!meta.name.trim()) {
      toast.push("Name is required", "error");
      return;
    }
    setSaving(true);

    let listId = list?.id;
    if (!listId) {
      const res = await fetch("/api/admin/price-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...meta, name: meta.name.trim() }),
      });
      if (!res.ok) {
        setSaving(false);
        toast.push((await res.json()).error ?? "Create failed", "error");
        return;
      }
      const { id } = await res.json();
      listId = id;
    } else {
      const res = await fetch(`/api/admin/price-lists/${listId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...meta, name: meta.name.trim() }),
      });
      if (!res.ok) {
        setSaving(false);
        toast.push((await res.json()).error ?? "Save failed", "error");
        return;
      }
    }

    const itemRows = Object.entries(prices)
      .filter(([, v]) => v !== "" && Number(v) > 0)
      .map(([product_id, v]) => ({ product_id, unit_price: Number(v) }));

    const itemsRes = await fetch(`/api/admin/price-lists/${listId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: itemRows }),
    });
    setSaving(false);
    if (!itemsRes.ok) {
      toast.push((await itemsRes.json()).error ?? "Items save failed", "error");
      return;
    }

    toast.push(
      `${itemRows.length} ${itemRows.length === 1 ? "price" : "prices"} saved`,
      "success",
    );
    if (!list) router.push(`/admin/price-lists/${listId}`);
    else router.refresh();
  }

  async function destroy() {
    if (!list) return;
    if (accountsUsing.length > 0) {
      toast.push("Unassign this list from all accounts first", "error");
      return;
    }
    if (!confirm(`Delete price list "${list.name}"? This can't be undone.`)) return;
    const res = await fetch(`/api/admin/price-lists/${list.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.push("Price list deleted", "success");
      router.push("/admin/price-lists");
    } else {
      toast.push((await res.json()).error ?? "Delete failed", "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-5 space-y-3">
        <Field label="Name">
          <Input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} />
        </Field>
        <Field label="Description" hint="Optional — visible to admins only.">
          <Textarea
            value={meta.description ?? ""}
            onChange={(e) => setMeta({ ...meta, description: e.target.value })}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={meta.active}
            onChange={(e) => setMeta({ ...meta, active: e.target.checked })}
          />
          Active
        </label>
        {accountsUsing.length > 0 ? (
          <div className="text-xs text-ink-secondary">
            Assigned to{" "}
            {accountsUsing.map((a, i) => (
              <span key={a.id}>
                <Link href={`/admin/accounts/${a.id}`} className="underline">
                  {a.name}
                </Link>
                {i < accountsUsing.length - 1 ? ", " : ""}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {list ? (
        <>
          <div className="flex items-center justify-between">
            <h2 className="display text-xl">Items</h2>
            <Input
              type="search"
              placeholder="Filter products"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-64"
            />
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-ink-secondary border-b border-black/5">
                <tr>
                  <th className="p-3">Product</th>
                  <th className="p-3">Wholesale</th>
                  <th className="p-3">List price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td className="p-3">
                      {p.name}
                      {p.pack_size ? (
                        <span className="text-xs text-ink-secondary block">{p.pack_size}</span>
                      ) : null}
                    </td>
                    <td className="p-3 mono">
                      {p.wholesale_price != null ? money(Number(p.wholesale_price)) : "—"}
                    </td>
                    <td className="p-3">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={prices[p.id] ?? ""}
                        onChange={(e) =>
                          setPrices({ ...prices, [p.id]: e.target.value })
                        }
                        className="w-28"
                        placeholder="—"
                      />
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-4 text-sm text-ink-secondary text-center">
                      No products match.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="text-sm text-ink-secondary">
          Save the list to start adding line prices.
        </div>
      )}

      <div className="sticky bottom-4 flex gap-2 items-center">
        <Button onClick={save} loading={saving}>
          Save
        </Button>
        {list ? (
          <Button onClick={destroy} variant="danger">
            Delete
          </Button>
        ) : null}
      </div>
    </div>
  );
}
