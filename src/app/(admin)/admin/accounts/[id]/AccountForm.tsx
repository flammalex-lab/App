"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Account, AccountType, AccountStatus, Category, Channel, DeliveryZone, PricingTier } from "@/lib/supabase/types";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { CATEGORY_LABELS, ZONE_LABELS } from "@/lib/constants";

const CAT_LIST: Category[] = ["beef", "pork", "eggs", "dairy", "produce"];
const ZONE_LIST: DeliveryZone[] = ["finger_lakes", "nyc_metro", "hudson_valley", "long_island", "nj_pa_ct"];

export function AccountForm({ account }: { account: Account | null }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: account?.name ?? "",
    type: (account?.type ?? "restaurant") as AccountType,
    channel: (account?.channel ?? "foodservice") as Channel,
    pricing_tier: (account?.pricing_tier ?? "standard") as PricingTier,
    status: (account?.status ?? "prospect") as AccountStatus,
    enabled_categories: (account?.enabled_categories ?? CAT_LIST) as Category[],
    primary_contact_name: account?.primary_contact_name ?? "",
    primary_contact_email: account?.primary_contact_email ?? "",
    primary_contact_phone: account?.primary_contact_phone ?? "",
    address_line1: account?.address_line1 ?? "",
    city: account?.city ?? "",
    state: account?.state ?? "NY",
    zip: account?.zip ?? "",
    delivery_zone: (account?.delivery_zone ?? null) as DeliveryZone | null,
    delivery_day: account?.delivery_day ?? "",
    order_minimum: account?.order_minimum ?? "",
    qb_customer_name: account?.qb_customer_name ?? "",
    qb_terms: account?.qb_terms ?? "",
    notes: account?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch(`/api/admin/accounts/${account?.id ?? "new"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        delivery_zone: form.delivery_zone || null,
        qb_terms: form.qb_terms || null,
        qb_customer_name: form.qb_customer_name || null,
        order_minimum: form.order_minimum === "" ? null : Number(form.order_minimum),
      }),
    });
    setSaving(false);
    if (!res.ok) { setMsg((await res.json()).error ?? "Save failed"); return; }
    const { id } = await res.json();
    if (!account) router.push(`/admin/accounts/${id}`);
    else router.refresh();
  }

  async function inviteBuyer() {
    if (!account) { setMsg("Save the account first."); return; }
    const phone = prompt("Buyer phone (US):");
    if (!phone) return;
    const name = prompt("Buyer name:") ?? "";
    setInviting(true);
    const res = await fetch(`/api/admin/accounts/${account.id}/invite-buyer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, name }),
    });
    setInviting(false);
    setMsg(res.ok ? "Invite sent via SMS." : (await res.json()).error ?? "Invite failed");
    if (res.ok) router.refresh();
  }

  function toggleCat(c: Category) {
    setForm((f) => ({
      ...f,
      enabled_categories: f.enabled_categories.includes(c)
        ? f.enabled_categories.filter((x) => x !== c)
        : [...f.enabled_categories, c],
    }));
  }

  return (
    <div className="card p-5 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Status">
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as AccountStatus })}>
            {(["prospect", "active", "inactive", "churned"] as AccountStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Type">
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AccountType })}>
            {(["restaurant", "grocery", "institutional", "country_club", "distributor", "other"] as AccountType[]).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Channel">
          <select className="input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as Channel })}>
            {(["foodservice", "retail", "institutional"] as Channel[]).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Tier">
          <select className="input" value={form.pricing_tier} onChange={(e) => setForm({ ...form, pricing_tier: e.target.value as PricingTier })}>
            {(["standard", "volume", "custom"] as PricingTier[]).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Buying profile" hint="Categories this account is allowed to order">
        <div className="flex flex-wrap gap-2 pt-1">
          {CAT_LIST.map((c) => (
            <label key={c} className={`px-3 py-1.5 rounded-full border cursor-pointer text-sm ${form.enabled_categories.includes(c) ? "bg-brand-green text-white border-brand-green" : "bg-white border-black/10"}`}>
              <input type="checkbox" className="hidden" checked={form.enabled_categories.includes(c)} onChange={() => toggleCat(c)} />
              {CATEGORY_LABELS[c]}
            </label>
          ))}
        </div>
      </Field>

      <div className="divider" />
      <h3 className="font-serif">Primary contact</h3>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Name"><Input value={form.primary_contact_name} onChange={(e) => setForm({ ...form, primary_contact_name: e.target.value })} /></Field>
        <Field label="Email"><Input value={form.primary_contact_email} onChange={(e) => setForm({ ...form, primary_contact_email: e.target.value })} /></Field>
        <Field label="Phone"><Input value={form.primary_contact_phone} onChange={(e) => setForm({ ...form, primary_contact_phone: e.target.value })} /></Field>
      </div>

      <div className="divider" />
      <h3 className="font-serif">Delivery</h3>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Zone">
          <select className="input" value={form.delivery_zone ?? ""} onChange={(e) => setForm({ ...form, delivery_zone: (e.target.value || null) as DeliveryZone | null })}>
            <option value="">—</option>
            {ZONE_LIST.map((z) => <option key={z} value={z}>{ZONE_LABELS[z]}</option>)}
          </select>
        </Field>
        <Field label="Delivery days"><Input value={form.delivery_day} onChange={(e) => setForm({ ...form, delivery_day: e.target.value })} /></Field>
      </div>
      <Field label="Order minimum ($)">
        <Input value={form.order_minimum as any} onChange={(e) => setForm({ ...form, order_minimum: e.target.value })} />
      </Field>

      <div className="divider" />
      <h3 className="font-serif">QuickBooks</h3>
      <div className="grid grid-cols-2 gap-3">
        <Field label="QB Customer:Job name" hint="Must match QBD exactly">
          <Input value={form.qb_customer_name} onChange={(e) => setForm({ ...form, qb_customer_name: e.target.value })} />
        </Field>
        <Field label="Terms override" hint="Blank = use default (Net 30)">
          <Input value={form.qb_terms} onChange={(e) => setForm({ ...form, qb_terms: e.target.value })} />
        </Field>
      </div>

      <div className="divider" />
      <Field label="Notes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>

      <div className="flex items-center gap-2 pt-2">
        <Button onClick={save} loading={saving}>Save</Button>
        {account ? <Button onClick={inviteBuyer} loading={inviting} variant="secondary">Invite buyer by SMS</Button> : null}
        {msg ? <span className="text-sm text-ink-secondary">{msg}</span> : null}
      </div>
    </div>
  );
}
