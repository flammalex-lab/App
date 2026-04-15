"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function QBExportForm({ pendingCount }: { pendingCount: number }) {
  const [format, setFormat] = useState<"iif" | "csv">("iif");
  const [loading, setLoading] = useState(false);

  async function download() {
    setLoading(true);
    const res = await fetch(`/api/admin/qb/export?format=${format}`, { method: "POST" });
    if (!res.ok) { setLoading(false); alert("Export failed."); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const filename = res.headers.get("x-filename") ?? `flf-qb-export.${format}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setLoading(false);
    window.location.reload();
  }

  return (
    <div className="flex items-center gap-3">
      <select className="input w-auto" value={format} onChange={(e) => setFormat(e.target.value as any)}>
        <option value="iif">IIF (QuickBooks)</option>
        <option value="csv">CSV (audit)</option>
      </select>
      <Button onClick={download} disabled={pendingCount === 0} loading={loading}>
        Export {pendingCount} order{pendingCount === 1 ? "" : "s"}
      </Button>
    </div>
  );
}
