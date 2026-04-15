"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderGuideItem, Product } from "@/lib/supabase/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CATEGORY_LABELS } from "@/lib/constants";

type Row = OrderGuideItem & { product: Product };

const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

export function GuideEditor({
  guideId,
  initialItems,
  allProducts,
}: {
  guideId: string;
  initialItems: Row[];
  allProducts: Product[];
}) {
  const [items, setItems] = useState<Row[]>(initialItems);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const router = useRouter();

  const existingIds = useMemo(() => new Set(items.map((i) => i.product_id)), [items]);
  const candidates = useMemo(
    () =>
      allProducts
        .filter((p) => !existingIds.has(p.id))
        .filter((p) => (search ? p.name.toLowerCase().includes(search.toLowerCase()) : true))
        .slice(0, 25),
    [allProducts, existingIds, search],
  );

  function add(product: Product) {
    setItems((xs) => [
      ...xs,
      {
        id: crypto.randomUUID(),
        order_guide_id: guideId,
        product_id: product.id,
        suggested_qty: null,
        par_levels: null,
        sort_order: xs.length * 10,
        product,
      },
    ]);
    setSearch("");
  }

  function remove(id: string) {
    setItems((xs) => xs.filter((x) => x.id !== id));
  }

  function setPar(id: string, day: string, val: string) {
    const qty = Number(val);
    setItems((xs) =>
      xs.map((x) => {
        if (x.id !== id) return x;
        const par = { ...(x.par_levels ?? {}) };
        if (!val || qty === 0) delete par[day];
        else par[day] = qty;
        return { ...x, par_levels: Object.keys(par).length ? par : null };
      }),
    );
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch(`/api/admin/order-guides/${guideId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((x, idx) => ({
          product_id: x.product_id,
          suggested_qty: x.suggested_qty,
          par_levels: x.par_levels,
          sort_order: idx * 10,
        })),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setMsg((await res.json()).error ?? "Save failed");
    } else {
      setMsg("Saved.");
      router.refresh();
    }
  }

  const grouped = items.reduce<Record<string, Row[]>>((acc, r) => {
    (acc[r.product.category] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="card p-4">
        <h3 className="font-serif text-lg mb-2">Add items</h3>
        <Input
          placeholder="Search catalog"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="mt-2 max-h-56 overflow-y-auto divide-y divide-black/5">
          {candidates.map((p) => (
            <button
              key={p.id}
              onClick={() => add(p)}
              className="w-full text-left p-2 hover:bg-bg-secondary flex justify-between text-sm"
            >
              <span>
                {p.name}
                {p.pack_size ? <span className="text-xs text-ink-secondary"> · {p.pack_size}</span> : null}
              </span>
              <span className="text-xs text-ink-secondary">{CATEGORY_LABELS[p.category]}</span>
            </button>
          ))}
          {!candidates.length ? <div className="p-2 text-xs text-ink-secondary">No matches.</div> : null}
        </div>
      </div>

      {Object.entries(grouped).map(([cat, rows]) => (
        <section key={cat}>
          <h3 className="font-serif text-lg mb-2">{CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}</h3>
          <div className="card divide-y divide-black/5">
            {rows.map((r) => (
              <div key={r.id} className="p-3 space-y-2">
                <div className="flex justify-between items-baseline">
                  <div>
                    <div className="font-medium">{r.product.name}</div>
                    <div className="text-xs text-ink-secondary">
                      {r.product.pack_size ?? ""} {r.product.sku ? `· ${r.product.sku}` : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => remove(r.id)}
                    className="text-xs text-feedback-error underline"
                  >
                    remove
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-xs">
                  {DAYS.map((d) => (
                    <label key={d.key} className="flex flex-col items-center gap-1">
                      <span className="text-ink-secondary">{d.label}</span>
                      <Input
                        type="number"
                        min={0}
                        className="w-full text-center px-1 py-1 text-sm"
                        value={(r.par_levels as any)?.[d.key] ?? ""}
                        onChange={(e) => setPar(r.id, d.key, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="sticky bottom-4 flex gap-2 items-center">
        <Button onClick={save} loading={saving}>Save guide</Button>
        {msg ? <span className="text-sm text-ink-secondary">{msg}</span> : null}
      </div>
    </div>
  );
}
