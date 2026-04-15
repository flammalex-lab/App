"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { QBSetting } from "@/lib/supabase/types";

export function QBSettingsForm({ settings }: { settings: QBSetting[] }) {
  const [state, setState] = useState<Record<string, string>>(
    () => Object.fromEntries(settings.map((s) => [s.key, s.value])),
  );
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function save() {
    setSaving(true);
    const res = await fetch("/api/admin/settings/qb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: state }),
    });
    setSaving(false);
    toast.push(res.ok ? "QB mapping saved" : "Error saving", res.ok ? "success" : "error");
  }

  return (
    <div className="card p-4 space-y-2">
      {settings.map((s) => (
        <div key={s.key} className="grid grid-cols-3 gap-2 items-center text-sm">
          <label className="col-span-1 text-ink-secondary mono">{s.key}</label>
          <Input
            className="col-span-2"
            value={state[s.key] ?? ""}
            onChange={(e) => setState({ ...state, [s.key]: e.target.value })}
          />
        </div>
      ))}
      <div className="flex items-center gap-2 pt-2">
        <Button onClick={save} loading={saving}>Save</Button>
      </div>
    </div>
  );
}
