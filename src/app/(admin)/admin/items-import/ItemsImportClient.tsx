"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface Row {
  sku: string;
  name: string;
  description?: string;
  wholesale_price?: number;
  retail_price?: number;
  unit?: string;
  pack_size?: string;
  income_account?: string;
  category_hint?: string;
  brand_hint?: string;
}

export function ItemsImportClient() {
  const [raw, setRaw] = useState<Row[]>([]);
  const [filename, setFilename] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number } | null>(null);
  const toast = useToast();

  async function handleFile(file: File) {
    setFilename(file.name);
    const text = await file.text();
    setRaw(parseCSV(text));
    setResult(null);
  }

  async function submit() {
    if (!raw.length) return;
    setUploading(true);
    const res = await fetch("/api/admin/items/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: raw }),
    });
    setUploading(false);
    if (!res.ok) {
      toast.push((await res.json()).error ?? "Import failed", "error");
      return;
    }
    const summary = await res.json();
    setResult(summary);
    toast.push(`Imported: ${summary.created} new, ${summary.updated} updated`, "success");
  }

  const preview = useMemo(() => raw.slice(0, 20), [raw]);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {filename ? (
          <p className="text-xs text-ink-secondary mt-2">
            {filename} — {raw.length} rows parsed
          </p>
        ) : null}
      </div>

      {preview.length > 0 ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-ink-secondary">
              <tr>
                <th className="p-2">SKU</th>
                <th className="p-2">Name</th>
                <th className="p-2">Wholesale</th>
                <th className="p-2">Retail</th>
                <th className="p-2">Unit</th>
                <th className="p-2">Income Acct</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((r, i) => (
                <tr key={i} className="border-t border-black/5">
                  <td className="p-2 mono">{r.sku}</td>
                  <td className="p-2">{r.name}</td>
                  <td className="p-2 mono">{r.wholesale_price ?? ""}</td>
                  <td className="p-2 mono">{r.retail_price ?? ""}</td>
                  <td className="p-2">{r.unit ?? ""}</td>
                  <td className="p-2">{r.income_account ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {raw.length > preview.length ? (
            <div className="p-2 text-xs text-ink-secondary">
              … {raw.length - preview.length} more rows
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={!raw.length} loading={uploading}>Import</Button>
        {result ? (
          <p className="text-sm">
            ✓ {result.created} created, {result.updated} updated, {result.skipped} skipped
          </p>
        ) : null}
      </div>

      <details className="text-xs text-ink-secondary">
        <summary>Expected column headers (any of these match)</summary>
        <p className="mt-1 leading-relaxed">
          <strong>SKU:</strong> Item, Item Name, Name, Number, Item Number, SKU.
          <strong> Name:</strong> Description, Sales Description, Item Description.
          <strong> Wholesale price:</strong> Price, Sales Price, Rate, Cost.
          <strong> Retail price:</strong> Retail, Retail Price.
          <strong> Unit:</strong> U/M, UOM, Unit, Unit of Measure.
          <strong> Income account:</strong> Account, Income Account.
          <strong> Category hint:</strong> Type, Category, Item Type.
          The importer is forgiving — partial data is fine, missing fields stay empty.
        </p>
      </details>
    </div>
  );
}

function parseCSV(text: string): Row[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  const find = (keys: string[]) =>
    headers.findIndex((h) => keys.some((k) => h === k || h.includes(k)));
  const h = {
    sku: find(["item name", "item number", "sku", "item", "number", "name"]),
    name: find(["description", "sales description", "item description"]),
    wholesale_price: find(["sales price", "price", "rate", "cost"]),
    retail_price: find(["retail"]),
    unit: find(["u/m", "uom", "unit of measure", "unit"]),
    pack_size: find(["pack size", "pack", "size"]),
    income_account: find(["income account", "account"]),
    category_hint: find(["type", "category", "item type"]),
    brand_hint: find(["manufacturer", "vendor", "brand"]),
  };
  const out: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCSVLine(lines[i]);
    const sku = cells[h.sku]?.trim();
    if (!sku) continue;
    const priceRaw = cells[h.wholesale_price]?.replace(/[$,]/g, "").trim();
    const retailRaw = cells[h.retail_price]?.replace(/[$,]/g, "").trim();
    out.push({
      sku,
      name: (cells[h.name]?.trim() || sku),
      wholesale_price: priceRaw && !isNaN(Number(priceRaw)) ? Number(priceRaw) : undefined,
      retail_price: retailRaw && !isNaN(Number(retailRaw)) ? Number(retailRaw) : undefined,
      unit: cells[h.unit]?.trim(),
      pack_size: cells[h.pack_size]?.trim(),
      income_account: cells[h.income_account]?.trim(),
      category_hint: cells[h.category_hint]?.trim(),
      brand_hint: cells[h.brand_hint]?.trim(),
    });
  }
  return out;
}

function splitCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}
