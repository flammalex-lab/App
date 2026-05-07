"use client";

import { useState } from "react";
import type { DeliveryZoneRow } from "@/lib/supabase/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ZONE_LABELS } from "@/lib/constants";

export function ZoneList({ zones }: { zones: DeliveryZoneRow[] }) {
  const [rows, setRows] = useState(zones);
  const [saving, setSaving] = useState<string | null>(null);

  async function save(zone: DeliveryZoneRow) {
    setSaving(zone.zone);
    await fetch("/api/admin/settings/zones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(zone),
    });
    setSaving(null);
  }

  return (
    <div className="card divide-y divide-black/5">
      {rows.map((z, idx) => (
        <div key={z.zone} className="p-3 space-y-2">
          <div className="font-medium">{ZONE_LABELS[z.zone]}</div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <label>Min ($)
              <Input
                value={z.order_minimum}
                onChange={(e) => setRows(rows.map((r, i) => i === idx ? { ...r, order_minimum: Number(e.target.value) || 0 } : r))}
              />
            </label>
            <label>Cutoff (hrs)
              <Input
                value={z.cutoff_hours_before_delivery}
                onChange={(e) => setRows(rows.map((r, i) => i === idx ? { ...r, cutoff_hours_before_delivery: Number(e.target.value) || 0 } : r))}
              />
            </label>
            <label>Delivery days (comma-sep)
              <Input
                value={z.delivery_days.join(", ")}
                onChange={(e) => setRows(rows.map((r, i) => i === idx ? { ...r, delivery_days: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } : r))}
              />
            </label>
          </div>
          <Button onClick={() => save(rows[idx])} loading={saving === z.zone} size="sm">Save</Button>
        </div>
      ))}
    </div>
  );
}
