"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Product, StandingFreq } from "@/lib/supabase/types";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { CATEGORY_LABELS } from "@/lib/constants";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export interface StandingNewClientProps {
  products: Product[];
  initial: {
    name: string;
    frequency: StandingFreq;
    /**
     * Default-selected weekdays. We pre-fill from the buyer's account-level
     * delivery_days (or legacy singular delivery_day) when one is available
     * — it's the most useful default and matches what their cart would do.
     */
    days_of_week: string[];
    require_confirmation: boolean;
    active: boolean;
    items: { product_id: string; quantity: number; notes: string | null }[];
  };
}

/**
 * New-standing-order form. Mobile-tuned variant of StandingOrderEditor:
 *
 * - Save is sticky at the bottom of the viewport, lifted above the
 *   BottomTabs (z-30) and the cart pill, and padded by
 *   safe-area-inset-bottom so it never hides under the iOS home indicator
 *   (B6).
 * - Save is disabled with helper text when zero days are picked, so we
 *   never persist a standing order that has no scheduled day to fire on
 *   (B7). Days are also pre-filled from the buyer's account delivery_days
 *   when present, which is the most useful default.
 *
 * Scope note: the existing StandingOrderEditor still powers the edit
 * route (/standing/[id]). This component owns the *new* route only.
 */
export function StandingNewClient({ products, initial }: StandingNewClientProps) {
  const [name, setName] = useState(initial.name);
  const [frequency, setFrequency] = useState<StandingFreq>(initial.frequency);
  const [days, setDays] = useState<string[]>(initial.days_of_week);
  // require_confirmation is held at `false` permanently — standing orders
  // auto-submit on the scheduled day. Column is kept on the DB for
  // backwards compat; the run logic ignores it.
  const [active, setActive] = useState(initial.active);
  const [items, setItems] = useState(initial.items);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const router = useRouter();

  const byId = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  const chosenIds = new Set(items.map((i) => i.product_id));
  const candidates = products
    .filter((p) => !chosenIds.has(p.id))
    .filter((p) => (search ? p.name.toLowerCase().includes(search.toLowerCase()) : true))
    .slice(0, 20);

  function toggleDay(d: string) {
    setDays((xs) => (xs.includes(d) ? xs.filter((x) => x !== d) : [...xs, d]));
  }

  function addItem(product: Product) {
    setItems((xs) => [...xs, { product_id: product.id, quantity: 1, notes: null }]);
    setSearch("");
  }

  function removeItem(pid: string) {
    setItems((xs) => xs.filter((x) => x.product_id !== pid));
  }

  function setQty(pid: string, qty: number) {
    setItems((xs) => xs.map((x) => (x.product_id === pid ? { ...x, quantity: qty } : x)));
  }

  // Inline validation gating Save (B7). We mirror the server-side checks
  // so the disabled state matches what would actually fail on submit.
  const nameError = !name.trim() ? "Give it a name" : null;
  const daysError = !days.length ? "Pick at least one day" : null;
  const itemsError = !items.length ? "Add at least one item" : null;
  const blockingError = nameError ?? daysError ?? itemsError;

  async function save() {
    if (blockingError) {
      toast.push(blockingError, "error");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/standing/new`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        frequency,
        days_of_week: days,
        require_confirmation: false,
        active,
        items,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.push((await res.json()).error ?? "Save failed", "error");
      return;
    }
    toast.push("Standing order saved", "success");
    router.push(`/standing`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Tuesday order" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Frequency">
            <select className="input" value={frequency} onChange={(e) => setFrequency(e.target.value as StandingFreq)}>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Every other week</option>
            </select>
          </Field>
          <Field label="Days of week" hint={daysError ?? undefined}>
            <div className="flex flex-wrap gap-1">
              {DAYS.map((d) => (
                <label
                  key={d}
                  className={`px-2 py-1 rounded-full text-xs border cursor-pointer ${days.includes(d) ? "bg-brand-green text-white border-brand-green" : "bg-white border-black/10"}`}
                >
                  <input type="checkbox" className="hidden" checked={days.includes(d)} onChange={() => toggleDay(d)} />
                  {d.slice(0, 3)}
                </label>
              ))}
            </div>
          </Field>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active
          </label>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-serif text-lg mb-2">Items</h3>
        <Input
          placeholder="Search catalog"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="mt-2 max-h-48 overflow-y-auto divide-y divide-black/5">
          {candidates.map((p) => (
            <button
              key={p.id}
              onClick={() => addItem(p)}
              className="w-full text-left p-2 hover:bg-bg-secondary flex justify-between text-sm"
            >
              <span>
                {p.name}
                {p.pack_size ? <span className="text-xs text-ink-secondary"> · {p.pack_size}</span> : null}
              </span>
              <span className="ml-2 inline-flex items-center text-[10px] font-medium uppercase tracking-wider text-brand-blue bg-brand-blue-tint rounded-full px-2 py-0.5 shrink-0">
                {CATEGORY_LABELS[p.category]}
              </span>
            </button>
          ))}
          {!candidates.length && search ? <div className="p-2 text-xs text-ink-secondary">No matches.</div> : null}
        </div>
        <div className="mt-3 divide-y divide-black/5">
          {items.map((it) => {
            const p = byId.get(it.product_id);
            if (!p) return null;
            return (
              <div key={it.product_id} className="py-2 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm">{p.name}</div>
                  <div className="text-xs text-ink-secondary">{p.pack_size ?? ""}</div>
                </div>
                <Input
                  type="number"
                  min={0}
                  className="w-20"
                  value={it.quantity}
                  onChange={(e) => setQty(it.product_id, Number(e.target.value) || 0)}
                />
                <span className="text-xs text-ink-secondary">{p.unit}</span>
                <button onClick={() => removeItem(it.product_id)} className="text-xs text-feedback-error underline">
                  remove
                </button>
              </div>
            );
          })}
          {!items.length ? <div className="p-2 text-sm text-ink-secondary">No items yet.</div> : null}
        </div>
      </div>

      {/* Spacer so the last card isn't hidden behind the sticky save bar.
          Roughly: save bar (~64px) + BottomTabs (~56px) + cart pill clearance. */}
      <div aria-hidden className="h-40 md:h-12" />

      {/*
       * Sticky save bar (B6 fix).
       *
       * - `fixed` + `inset-x-0` + `bottom-0` pins to the viewport.
       * - `z-40` puts it above BottomTabs (z-30) and the cart pill (z-20).
       * - `pb-[max(env(safe-area-inset-bottom),0.5rem)]` keeps the button
       *   clear of the iOS home indicator on 390-wide mobile.
       * - `md:static` lets it return to normal flow on desktop where the
       *   sticky overlay is unnecessary.
       */}
      <div className="fixed inset-x-0 bottom-0 z-40 bg-white border-t border-black/10 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] shadow-sticky md:static md:bg-transparent md:border-0 md:px-0 md:pt-0 md:pb-0 md:shadow-none">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Button
            onClick={save}
            loading={saving}
            disabled={!!blockingError}
            className="flex-1 md:flex-none"
          >
            Save
          </Button>
          {blockingError ? (
            <span className="text-xs text-ink-secondary leading-snug">{blockingError}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
