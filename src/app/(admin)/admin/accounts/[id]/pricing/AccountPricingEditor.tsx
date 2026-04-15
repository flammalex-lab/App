"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountPricing, PricingTier, Product } from "@/lib/supabase/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { TIER_MULTIPLIERS } from "@/lib/constants";
import { money } from "@/lib/utils/format";

export function AccountPricingEditor({
  accountId,
  tier,
  products,
  overrides,
}: {
  accountId: string;
  tier: PricingTier;
  products: Product[];
  overrides: AccountPricing[];
}) {
  const mult = TIER_MULTIPLIERS[tier];
  const initial = useMemo(() => {
    const m: Record<string, string> = {};
    for (const o of overrides) m[o.product_id] = String(o.custom_price);
    return m;
  }, [overrides]);

  const [state, setState] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function save() {
    setSaving(true);
    const entries = Object.entries(state)
      .filter(([, v]) => v !== "" && Number(v) > 0)
      .map(([product_id, v]) => ({ product_id, custom_price: Number(v) }));

    const res = await fetch(`/api/admin/accounts/${accountId}/pricing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ overrides: entries }),
    });
    setSaving(false);
    if (res.ok) {
      toast.push(`${entries.length} overrides saved`, "success");
      router.refresh();
    } else {
      toast.push((await res.json()).error ?? "Save failed", "error");
    }
  }

  return (
    <div className="space-y-3">
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-ink-secondary border-b border-black/5">
            <tr>
              <th className="p-3">Product</th>
              <th className="p-3">Tier price ({tier})</th>
              <th className="p-3">Custom</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {products.map((p) => {
              const tierPrice = p.wholesale_price != null ? Number(p.wholesale_price) * mult : null;
              return (
                <tr key={p.id}>
                  <td className="p-3">
                    {p.name}
                    {p.pack_size ? (
                      <span className="text-xs text-ink-secondary block">{p.pack_size}</span>
                    ) : null}
                  </td>
                  <td className="p-3 mono">{tierPrice != null ? money(tierPrice) : "—"}</td>
                  <td className="p-3">
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={state[p.id] ?? ""}
                      onChange={(e) => setState({ ...state, [p.id]: e.target.value })}
                      className="w-28"
                      placeholder="—"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="sticky bottom-4 flex gap-2 items-center">
        <Button onClick={save} loading={saving}>Save</Button>
      </div>
    </div>
  );
}
