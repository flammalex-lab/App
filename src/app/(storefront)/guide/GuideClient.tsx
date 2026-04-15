"use client";

import { useState } from "react";
import Link from "next/link";
import type { OrderGuideItem, Product } from "@/lib/supabase/types";
import { useCart } from "@/lib/cart/store";
import { money } from "@/lib/utils/format";
import { Button } from "@/components/ui/Button";
import { CATEGORY_LABELS, DAY_SHORT } from "@/lib/constants";

type Row = OrderGuideItem & { product: Product; unitPrice: number | null };

export function GuideClient({ items }: { items: Row[] }) {
  const [draft, setDraft] = useState<Record<string, number>>(() => {
    const today = DAY_SHORT[new Date().toLocaleDateString("en-US", { weekday: "long" }) as keyof typeof DAY_SHORT] ?? "mon";
    const out: Record<string, number> = {};
    for (const row of items) {
      const par = row.par_levels?.[today] ?? row.suggested_qty ?? 0;
      out[row.product_id] = Number(par) || 0;
    }
    return out;
  });
  const addMany = useCart((s) => s.bulkSet);
  const cartLines = useCart((s) => s.lines);

  function setQty(productId: string, qty: number) {
    setDraft((d) => ({ ...d, [productId]: Math.max(0, qty) }));
  }

  function addToCart() {
    const lines = items
      .filter((r) => (draft[r.product_id] ?? 0) > 0 && r.unitPrice != null)
      .map((r) => ({
        productId: r.product_id,
        sku: r.product.sku,
        name: r.product.name,
        packSize: r.product.pack_size,
        unit: r.product.unit,
        unitPrice: r.unitPrice!,
        quantity: draft[r.product_id]!,
      }));
    // merge with any existing cart items not in guide
    const kept = cartLines.filter((l) => !lines.find((x) => x.productId === l.productId));
    addMany([...kept, ...lines]);
    window.location.href = "/cart";
  }

  const grouped = group(items);

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([cat, rows]) => (
        <section key={cat}>
          <h2 className="text-lg font-serif mb-2">{CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat}</h2>
          <div className="card divide-y divide-black/5">
            {rows.map((row) => (
              <GuideRow
                key={row.id}
                row={row}
                qty={draft[row.product_id] ?? 0}
                onQty={(q) => setQty(row.product_id, q)}
              />
            ))}
          </div>
        </section>
      ))}
      <div className="sticky bottom-16 md:bottom-4 flex justify-end">
        <Button onClick={addToCart} size="lg" className="shadow-card">
          Add to cart · {money(Object.entries(draft).reduce((s, [pid, q]) => {
            const row = items.find((r) => r.product_id === pid);
            return row?.unitPrice ? s + row.unitPrice * q : s;
          }, 0))}
        </Button>
      </div>
    </div>
  );
}

function GuideRow({ row, qty, onQty }: { row: Row; qty: number; onQty: (q: number) => void }) {
  const { product, unitPrice } = row;
  return (
    <div className="flex items-center gap-3 p-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <Link href={`/catalog/${product.id}`} className="font-medium hover:underline">
            {product.name}
          </Link>
          {product.pack_size ? <span className="text-xs text-ink-secondary">{product.pack_size}</span> : null}
        </div>
        <div className="text-xs text-ink-secondary">
          {product.sku ? <span className="mono mr-2">{product.sku}</span> : null}
          {unitPrice != null ? <span className="mono">{money(unitPrice)}/{product.unit}</span> : <span>price TBD</span>}
          {!product.available_this_week ? <span className="ml-2 badge-gray">unavail this week</span> : null}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => onQty(qty - 1)} className="h-8 w-8 rounded border border-black/10">−</button>
        <input
          type="number"
          inputMode="numeric"
          className="input w-16 text-center"
          value={qty}
          onChange={(e) => onQty(Number(e.target.value) || 0)}
        />
        <button onClick={() => onQty(qty + 1)} className="h-8 w-8 rounded border border-black/10">+</button>
      </div>
    </div>
  );
}

function group(items: Row[]): Record<string, Row[]> {
  const out: Record<string, Row[]> = {};
  for (const r of items) {
    const key = r.product.category;
    (out[key] ??= []).push(r);
  }
  return out;
}
