"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Product, StandingFreq } from "@/lib/supabase/types";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { CATEGORY_LABELS } from "@/lib/constants";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export interface StandingOrderEditorProps {
  standingOrderId: string | null;
  initial: {
    name: string;
    frequency: StandingFreq;
    days_of_week: string[];
    require_confirmation: boolean;
    active: boolean;
    items: { product_id: string; quantity: number; notes: string | null }[];
  };
  products: Product[];
  /** Admin view must pick account + buyer; buyer view uses their own. */
  adminContext?: {
    accounts: { id: string; name: string; buyers: { id: string; name: string }[] }[];
    accountId: string | null;
    profileId: string | null;
  };
}

export function StandingOrderEditor(props: StandingOrderEditorProps) {
  const { standingOrderId, products, initial, adminContext } = props;
  const [name, setName] = useState(initial.name);
  const [frequency, setFrequency] = useState<StandingFreq>(initial.frequency);
  const [days, setDays] = useState<string[]>(initial.days_of_week);
  const [requireConfirm, setRequireConfirm] = useState(initial.require_confirmation);
  const [active, setActive] = useState(initial.active);
  const [items, setItems] = useState(initial.items);
  const [search, setSearch] = useState("");
  const [accountId, setAccountId] = useState<string | null>(adminContext?.accountId ?? null);
  const [profileId, setProfileId] = useState<string | null>(adminContext?.profileId ?? null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
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

  async function save() {
    setMsg(null);
    if (!name.trim()) { setMsg("Give it a name."); return; }
    if (!days.length) { setMsg("Pick at least one day."); return; }
    if (!items.length) { setMsg("Add at least one item."); return; }
    if (adminContext && (!accountId || !profileId)) { setMsg("Pick an account and buyer."); return; }

    setSaving(true);
    const res = await fetch(`/api/standing/${standingOrderId ?? "new"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        frequency,
        days_of_week: days,
        require_confirmation: requireConfirm,
        active,
        items,
        account_id: accountId,
        profile_id: profileId,
      }),
    });
    setSaving(false);
    if (!res.ok) { setMsg((await res.json()).error ?? "Save failed"); return; }
    const { id } = await res.json();
    router.push(adminContext ? `/admin/standing` : `/standing`);
    router.refresh();
    if (!standingOrderId) router.push(adminContext ? `/admin/standing/${id}` : `/standing`);
  }

  async function del() {
    if (!standingOrderId) return;
    if (!confirm("Delete this standing order?")) return;
    await fetch(`/api/standing/${standingOrderId}`, { method: "DELETE" });
    router.push(adminContext ? `/admin/standing` : `/standing`);
    router.refresh();
  }

  const buyers = adminContext
    ? adminContext.accounts.find((a) => a.id === accountId)?.buyers ?? []
    : [];

  return (
    <div className="space-y-4">
      {adminContext ? (
        <div className="card p-4 grid grid-cols-2 gap-3">
          <Field label="Account">
            <select
              className="input"
              value={accountId ?? ""}
              onChange={(e) => { setAccountId(e.target.value || null); setProfileId(null); }}
            >
              <option value="">—</option>
              {adminContext.accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Buyer">
            <select
              className="input"
              value={profileId ?? ""}
              onChange={(e) => setProfileId(e.target.value || null)}
              disabled={!accountId}
            >
              <option value="">—</option>
              {buyers.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </Field>
        </div>
      ) : null}

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
          <Field label="Days of week">
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
            <input type="checkbox" checked={requireConfirm} onChange={(e) => setRequireConfirm(e.target.checked)} />
            Text me to confirm before submitting
          </label>
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
              <span className="text-xs text-ink-secondary">{CATEGORY_LABELS[p.category]}</span>
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

      <div className="flex items-center gap-2">
        <Button onClick={save} loading={saving}>Save</Button>
        {standingOrderId ? <Button onClick={del} variant="danger">Delete</Button> : null}
        {msg ? <span className="text-sm text-feedback-error">{msg}</span> : null}
      </div>
    </div>
  );
}
