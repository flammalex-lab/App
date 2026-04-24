"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { BUYER_TYPE_LABELS, type BuyerType } from "@/lib/constants";

const BUYER_TYPES: BuyerType[] = [
  "gm_restaurant",
  "gm_retail",
  "meat_buyer",
  "produce_buyer",
  "dairy_buyer",
  "cheese_buyer",
  "grocery_buyer",
];

interface AccountLite {
  id: string;
  name: string;
  buyer_type: string | null;
}

interface TemplateLite {
  id: string;
  name: string;
  buyer_type: string | null;
  itemCount: number;
}

type AccountMode =
  | { kind: "pick"; query: string }
  | { kind: "picked"; account: AccountLite }
  | { kind: "creating"; name: string; saving: boolean };

/**
 * Field-optimized flow for adding a buyer from anywhere in the admin.
 * Triggered from the sidebar button — works without navigating to a
 * specific account first. Supports creating a new account inline when
 * the buyer's restaurant isn't in the system yet.
 *
 * Layout is full-screen on mobile (easier thumb targets in the field)
 * and a centered modal on desktop.
 */
export function QuickAddBuyerDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();

  const [accounts, setAccounts] = useState<AccountLite[]>([]);
  const [templates, setTemplates] = useState<TemplateLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AccountMode>({ kind: "pick", query: "" });
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    title: "",
    buyer_type: "gm_restaurant" as BuyerType,
  });
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Load accounts + templates on open.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const [accRes, tplRes] = await Promise.all([
        fetch("/api/admin/accounts/list?limit=500"),
        fetch("/api/admin/order-guide-templates/list"),
      ]);
      if (accRes.ok) setAccounts((await accRes.json()).accounts ?? []);
      if (tplRes.ok) setTemplates((await tplRes.json()).templates ?? []);
      setLoading(false);
    })();
  }, [open]);

  // Reset when closed.
  useEffect(() => {
    if (open) return;
    setMode({ kind: "pick", query: "" });
    setForm({ name: "", phone: "", email: "", title: "", buyer_type: "gm_restaurant" });
    setSelectedTemplateIds([]);
  }, [open]);

  const filteredAccounts = useMemo(() => {
    if (mode.kind !== "pick") return [];
    const q = mode.query.trim().toLowerCase();
    if (!q) return accounts.slice(0, 15);
    return accounts.filter((a) => a.name.toLowerCase().includes(q)).slice(0, 15);
  }, [accounts, mode]);

  async function createAccount() {
    if (mode.kind !== "creating") return;
    if (!mode.name.trim()) {
      toast.push("Account name required", "error");
      return;
    }
    setMode({ ...mode, saving: true });
    const res = await fetch("/api/admin/accounts/new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: mode.name.trim(),
        type: "restaurant",
        channel: "foodservice",
        pricing_tier: "standard",
        status: "active",
      }),
    });
    if (!res.ok) {
      toast.push((await res.json()).error ?? "Create failed", "error");
      setMode({ ...mode, saving: false });
      return;
    }
    const { id } = (await res.json()) as { id: string };
    const newAccount: AccountLite = { id, name: mode.name.trim(), buyer_type: null };
    setAccounts((as) => [newAccount, ...as]);
    setMode({ kind: "picked", account: newAccount });
  }

  async function submit() {
    if (mode.kind !== "picked") {
      toast.push("Pick or create an account first", "error");
      return;
    }
    if (!form.name.trim() || !form.phone.trim()) {
      toast.push("Buyer name and phone required", "error");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/admin/accounts/${mode.account.id}/invite-buyer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        title: form.title.trim() || null,
        buyer_type: form.buyer_type,
        template_ids: selectedTemplateIds,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.push((await res.json()).error ?? "Failed", "error");
      return;
    }
    const { seeded } = (await res.json()) as { seeded?: number };
    toast.push(
      seeded && seeded > 0
        ? `Added to ${mode.account.name} · seeded ${seeded} items`
        : `Added to ${mode.account.name}`,
      "success",
    );
    onClose();
    router.push(`/admin/accounts/${mode.account.id}`);
  }

  if (!open) return null;

  const suggestedTemplates = templates.filter((t) => t.buyer_type === form.buyer_type);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center bg-black/50">
      <div className="bg-white w-full md:max-w-lg md:rounded-2xl md:shadow-xl md:m-4 rounded-t-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-black/5">
          <div>
            <h2 className="display text-xl">Add buyer</h2>
            {mode.kind === "picked" ? (
              <p className="text-xs text-ink-secondary mt-0.5">
                For <strong>{mode.account.name}</strong> ·{" "}
                <button
                  onClick={() => setMode({ kind: "pick", query: "" })}
                  className="underline hover:text-ink-primary"
                >
                  change
                </button>
              </p>
            ) : (
              <p className="text-xs text-ink-secondary mt-0.5">Quick field flow</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="h-9 w-9 rounded-full hover:bg-bg-secondary flex items-center justify-center text-2xl leading-none text-ink-tertiary hover:text-ink-primary"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {mode.kind === "pick" ? (
            <>
              <Field label="Account" hint="Search or add new">
                <Input
                  autoFocus
                  value={mode.query}
                  onChange={(e) => setMode({ kind: "pick", query: e.target.value })}
                  placeholder="Mighty Quinn's Barbecue"
                />
              </Field>
              {loading ? (
                <p className="text-xs text-ink-tertiary">Loading accounts…</p>
              ) : null}
              <div className="border border-black/5 rounded-lg divide-y divide-black/5 max-h-72 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => setMode({ kind: "creating", name: mode.query, saving: false })}
                  className="w-full text-left p-3 hover:bg-bg-secondary flex items-center gap-2"
                >
                  <span className="h-7 w-7 rounded-full bg-brand-green/10 text-brand-green flex items-center justify-center text-sm">
                    +
                  </span>
                  <span className="text-sm font-medium">
                    New account
                    {mode.query ? (
                      <span className="text-ink-secondary font-normal"> · {mode.query}</span>
                    ) : null}
                  </span>
                </button>
                {filteredAccounts.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setMode({ kind: "picked", account: a })}
                    className="w-full text-left p-3 hover:bg-bg-secondary text-sm"
                  >
                    {a.name}
                  </button>
                ))}
                {!loading && filteredAccounts.length === 0 && mode.query ? (
                  <div className="p-3 text-xs text-ink-tertiary">
                    No matches. Tap &ldquo;New account&rdquo; above.
                  </div>
                ) : null}
              </div>
            </>
          ) : mode.kind === "creating" ? (
            <>
              <Field label="New account name">
                <Input
                  autoFocus
                  value={mode.name}
                  onChange={(e) => setMode({ ...mode, name: e.target.value })}
                  placeholder="Mighty Quinn's Barbecue"
                />
              </Field>
              <p className="text-xs text-ink-secondary">
                Creates an account with sensible defaults (Restaurant · Foodservice ·
                Standard pricing · Active). You can fill in delivery zone, QB details,
                and contacts from the account page later.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  loading={mode.saving}
                  onClick={createAccount}
                  disabled={!mode.name.trim()}
                >
                  Create account &amp; continue
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMode({ kind: "pick", query: mode.name })}
                  disabled={mode.saving}
                >
                  Back
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name">
                  <Input
                    autoFocus
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Chef Hugh"
                  />
                </Field>
                <Field label="Title">
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Executive Chef"
                  />
                </Field>
              </div>
              <Field label="Phone">
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                  inputMode="tel"
                  type="tel"
                />
              </Field>
              <Field label="Email (optional)">
                <Input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  type="email"
                  inputMode="email"
                />
              </Field>
              <Field label="Buyer type">
                <select
                  className="input"
                  value={form.buyer_type}
                  onChange={(e) => setForm({ ...form, buyer_type: e.target.value as BuyerType })}
                >
                  {BUYER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {BUYER_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </Field>

              {templates.length > 0 ? (
                <div>
                  <div className="label mb-1">Starter templates</div>
                  {suggestedTemplates.length > 0 && selectedTemplateIds.length === 0 ? (
                    <p className="text-[11px] text-ink-tertiary mb-1">
                      Suggested: {suggestedTemplates.map((t) => t.name).join(", ")}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-1.5">
                    {templates.map((t) => {
                      const on = selectedTemplateIds.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() =>
                            setSelectedTemplateIds((xs) =>
                              xs.includes(t.id) ? xs.filter((x) => x !== t.id) : [...xs, t.id],
                            )
                          }
                          className={`px-3 py-1 rounded-full border text-xs transition ${
                            on
                              ? "bg-brand-blue text-white border-brand-blue"
                              : "bg-white text-ink-primary border-black/10 hover:bg-bg-secondary"
                          }`}
                        >
                          {t.name}{" "}
                          <span className={`tabular ${on ? "opacity-80" : "text-ink-tertiary"}`}>
                            {t.itemCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        {mode.kind === "picked" ? (
          <div className="border-t border-black/5 px-5 py-3 flex items-center gap-2">
            <Button variant="ghost" onClick={() => setMode({ kind: "pick", query: "" })}>
              Back
            </Button>
            <div className="flex-1" />
            <Button onClick={submit} loading={saving}>
              Add buyer
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
