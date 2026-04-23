"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/store";
import { money } from "@/lib/utils/format";
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
  const [search, setSearch] = useState("");

  // Seed draft qty from today's par level, falling back to suggested qty.
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

  const searchMatch = (r: GuideRow) =>
    !search || r.product.name.toLowerCase().includes(search.toLowerCase());
  const visibleCount = items.filter(searchMatch).length;

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
    const kept = cartLines.filter(
      (l) => !newLines.find((x) => x.productId === l.productId) || l.variantKey !== null,
    );
    bulkSet([...kept, ...newLines]);
    router.push("/cart");
  }

  // Group items by product_group; preserve original order within group.
  const byGroup = useMemo(() => {
    const out: Record<string, GuideRow[]> = {};
    for (const r of items) {
      const g = (r.product.product_group as string | null) ?? "_other";
      (out[g] ??= []).push(r);
    }
    return out;
  }, [items]);

  const orderedGroups: (ProductGroup | "_other")[] = [
    ...groups,
    ...(byGroup._other ? (["_other"] as const) : []),
  ];

  return (
    <>
      <div className="px-4 md:px-0 mb-3">
        <input
          type="search"
          placeholder="Search your guide"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input"
        />
      </div>

      {visibleCount === 0 ? (
        <div className="px-4 md:px-0 py-8 text-center text-sm text-ink-secondary">
          No items match &ldquo;{search}&rdquo;.
        </div>
      ) : (
        orderedGroups.map((g) => {
          const rows = byGroup[g] ?? [];
          const filtered = rows.filter(searchMatch);
          if (filtered.length === 0) return null;
          const label = g === "_other" ? "Other" : GROUP_LABELS[g as ProductGroup];
          return (
            <section key={g} className="mb-6">
              <div className="flex items-baseline justify-between px-4 md:px-0 mb-2">
                <h2 className="display text-lg tracking-tight">{label}</h2>
                <span className="text-xs text-ink-tertiary tabular">
                  {filtered.length} {filtered.length === 1 ? "item" : "items"}
                </span>
              </div>
              <div className="flex gap-3 overflow-x-auto px-4 md:px-0 pb-2 snap-x">
                {filtered.map((r) => (
                  <GuideCard
                    key={r.id}
                    row={r}
                    qty={draft[r.product_id] ?? 0}
                    onQty={(q) => setQty(r.product_id, q)}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}

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
              <span className="tabular">{money(totalInCart)}</span>
              <span className="ml-2">Review →</span>
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function GuideCard({
  row,
  qty,
  onQty,
}: {
  row: GuideRow;
  qty: number;
  onQty: (q: number) => void;
}) {
  const { product, unitPrice } = row;
  const available = product.available_this_week;
  const producerHref = product.producer
    ? `/catalog?producer=${encodeURIComponent(product.producer)}`
    : null;

  return (
    <div className="shrink-0 w-[170px] snap-start card overflow-hidden relative hover:shadow-lg transition">
      <Link href={`/catalog/${product.id}`} aria-label={product.name} className="absolute inset-0 z-0" />

      <div className="relative aspect-square bg-bg-secondary pointer-events-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={productImage(product)}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        {!available ? (
          <span className="absolute top-1.5 right-1.5 badge-gray text-[9px] bg-white/90">
            limited
          </span>
        ) : null}
        {qty > 0 ? (
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-brand-blue text-white tabular shadow-sm">
            {qty}
          </span>
        ) : null}
      </div>

      <div className="relative p-2.5 pointer-events-none">
        <div className="text-[12px] font-medium leading-tight line-clamp-2 min-h-[28px]">
          {product.name}
        </div>
        {product.producer && producerHref ? (
          <Link
            href={producerHref}
            className="mt-0.5 inline-block max-w-full truncate text-[10px] text-ink-tertiary hover:text-ink-secondary hover:underline pointer-events-auto"
          >
            {product.producer}
          </Link>
        ) : null}
        <div className="tabular text-[12px] mt-1">
          {unitPrice != null ? money(unitPrice) : "—"}
          <span className="text-ink-tertiary text-[10px]"> / {product.unit}</span>
        </div>
      </div>

      <div className="relative border-t border-black/5 px-2 py-1.5 flex items-center justify-between gap-1 pointer-events-auto">
        <button
          aria-label="Decrement"
          onClick={() => onQty(qty - 1)}
          disabled={qty <= 0}
          className="h-7 w-7 rounded-full border border-black/10 flex items-center justify-center text-sm disabled:opacity-40 hover:bg-bg-secondary transition"
        >
          −
        </button>
        <div className="flex-1 text-center">
          <span className="tabular text-sm font-semibold leading-none block">{qty}</span>
          <span className="text-[9px] text-ink-tertiary uppercase tracking-wide">
            {product.unit}
          </span>
        </div>
        <button
          aria-label="Increment"
          onClick={() => onQty(qty + 1)}
          disabled={!available}
          className="h-7 w-7 rounded-full bg-brand-blue text-white flex items-center justify-center text-sm disabled:opacity-40 hover:bg-brand-blue-dark transition"
        >
          +
        </button>
      </div>
    </div>
  );
}
