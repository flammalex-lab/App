"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/store";
import { money, dateShort } from "@/lib/utils/format";
import { GROUP_LABELS, DAY_SHORT, type ProductGroup } from "@/lib/constants";
import { productImage } from "@/lib/utils/product-image";
import { Button } from "@/components/ui/Button";
import type { GuideRow } from "./page";

interface Props {
  items: GuideRow[];
  groups: ProductGroup[];
}

export function GuideClient({ items, groups }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<ProductGroup | null>(null);
  const [search, setSearch] = useState("");

  // Seed draft qty from today's par level, falling back to suggested qty
  const todayKey =
    DAY_SHORT[
      new Date().toLocaleDateString("en-US", { weekday: "long" }) as keyof typeof DAY_SHORT
    ] ?? "mon";
  const [draft, setDraft] = useState<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const r of items) {
      const par =
        (r.par_levels as Record<string, number> | null)?.[todayKey] ?? r.suggested_qty ?? 0;
      out[r.product_id] = Number(par) || 0;
    }
    return out;
  });

  const bulkSet = useCart((s) => s.bulkSet);
  const cartLines = useCart((s) => s.lines);

  const visible = useMemo(() => {
    return items.filter((r) => {
      if (filter && r.product.product_group !== filter) return false;
      if (search && !r.product.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [items, filter, search]);

  const totalInCart = Object.entries(draft).reduce((s, [pid, q]) => {
    const row = items.find((r) => r.product_id === pid);
    return row?.unitPrice && q > 0 ? s + row.unitPrice * q : s;
  }, 0);
  const itemsInCart = Object.values(draft).filter((q) => q > 0).length;

  function setQty(productId: string, qty: number) {
    setDraft((d) => ({ ...d, [productId]: Math.max(0, qty) }));
  }

  function addToCart() {
    const newLines = items
      .filter((r) => (draft[r.product_id] ?? 0) > 0 && r.unitPrice != null)
      .map((r) => ({
        productId: r.product_id,
        variantKey: null,
        variantSku: null,
        sku: r.product.sku,
        name: r.product.name,
        packSize: r.product.pack_size,
        unit: r.product.unit,
        unitPrice: r.unitPrice!,
        priceByWeight: Boolean(r.product.price_by_weight),
        quantity: draft[r.product_id]!,
      }));
    // Only replace the default-variant line for these products; keep any
    // non-default variants the buyer added elsewhere.
    const kept = cartLines.filter(
      (l) => !newLines.find((x) => x.productId === l.productId) || l.variantKey !== null,
    );
    bulkSet([...kept, ...newLines]);
    router.push("/cart");
  }

  return (
    <>
      <div className="px-4 md:px-0 mb-3 space-y-2">
        <input
          type="search"
          placeholder="Search your guide"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input"
        />
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-1">
          <FilterChip active={filter === null} onClick={() => setFilter(null)}>
            All ({items.length})
          </FilterChip>
          {groups.map((g) => {
            const count = items.filter((r) => r.product.product_group === g).length;
            return (
              <FilterChip key={g} active={filter === g} onClick={() => setFilter(g)}>
                {GROUP_LABELS[g]} ({count})
              </FilterChip>
            );
          })}
        </div>
      </div>

      <ul className="divide-y divide-black/5 border-y border-black/5 bg-white md:border md:rounded-xl md:shadow-card md:border-black/5">
        {visible.map((r) => (
          <GuideLineItem
            key={r.id}
            row={r}
            qty={draft[r.product_id] ?? 0}
            onQty={(q) => setQty(r.product_id, q)}
          />
        ))}
        {visible.length === 0 ? (
          <li className="p-6 text-center text-sm text-ink-secondary">
            No items match that filter.
          </li>
        ) : null}
      </ul>

      {itemsInCart > 0 ? (
        <div className="fixed bottom-[80px] md:bottom-6 inset-x-0 px-4 md:px-6 z-20 pointer-events-none">
          <div className="max-w-3xl mx-auto pointer-events-auto">
            <Button
              onClick={addToCart}
              size="lg"
              className="w-full shadow-sticky animate-slide-up"
            >
              <span className="flex-1 text-left">
                {itemsInCart} {itemsInCart === 1 ? "item" : "items"}
              </span>
              <span className="mono">{money(totalInCart)}</span>
              <span className="ml-2">Review →</span>
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1.5 rounded-full border text-sm transition ${
        active
          ? "bg-brand-blue text-white border-brand-blue"
          : "bg-white border-black/10 hover:bg-bg-secondary"
      }`}
    >
      {children}
    </button>
  );
}

function GuideLineItem({
  row,
  qty,
  onQty,
}: {
  row: GuideRow;
  qty: number;
  onQty: (q: number) => void;
}) {
  const { product, unitPrice, lastOrderedAt } = row;
  const image = productImage(product);
  const available = product.available_this_week;

  return (
    <li className="p-3 flex items-center gap-3">
      <Link href={`/catalog/${product.id}`} className="shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={product.name}
          className="h-16 w-16 rounded-md object-cover bg-bg-secondary"
        />
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={`/catalog/${product.id}`} className="block">
          <div className="font-medium text-sm leading-tight">{product.name}</div>
        </Link>
        <div className="text-xs text-ink-secondary mt-0.5">
          {unitPrice != null ? (
            <span className="mono">
              {money(unitPrice)} / {product.unit}
            </span>
          ) : (
            <span>Price on request</span>
          )}
          {product.pack_size ? <span> · {product.pack_size}</span> : null}
        </div>
        <div className="text-[11px] text-ink-tertiary mt-0.5">
          {lastOrderedAt ? (
            <>Last ordered {dateShort(lastOrderedAt)}</>
          ) : (
            <span className="text-ink-tertiary">Never ordered</span>
          )}
          {!available ? <span className="ml-2 badge-gray">limited</span> : null}
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-1">
        <button
          aria-label="Decrement"
          onClick={() => onQty(qty - 1)}
          disabled={qty <= 0}
          className="h-9 w-9 rounded-full border border-black/10 flex items-center justify-center disabled:opacity-40 hover:bg-bg-secondary transition"
        >
          −
        </button>
        <div className="min-w-[56px] px-2 py-1.5 text-center border border-black/10 rounded-md bg-white">
          <span className="mono text-sm font-semibold block leading-none">{qty}</span>
          <span className="text-[10px] text-ink-secondary uppercase tracking-wide">
            {product.unit}
          </span>
        </div>
        <button
          aria-label="Increment"
          onClick={() => onQty(qty + 1)}
          disabled={!available}
          className="h-9 w-9 rounded-full bg-brand-blue text-white flex items-center justify-center disabled:opacity-40 hover:bg-brand-blue-dark transition"
        >
          +
        </button>
      </div>
    </li>
  );
}
