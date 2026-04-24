"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface Row {
  sku: string;
  upc?: string;
  name: string;
  description?: string;
  wholesale_price?: number;
  retail_price?: number;
  unit?: string;
  pack_size?: string;
  case_pack?: string;
  producer?: string;
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
                <th className="p-2">UPC</th>
                <th className="p-2">Name</th>
                <th className="p-2">Producer</th>
                <th className="p-2">Pack</th>
                <th className="p-2">Case</th>
                <th className="p-2">Wholesale</th>
                <th className="p-2">Retail</th>
                <th className="p-2">Unit</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((r, i) => (
                <tr key={i} className="border-t border-black/5">
                  <td className="p-2 tabular">{r.sku}</td>
                  <td className="p-2 tabular">{r.upc ?? ""}</td>
                  <td className="p-2">{r.name}</td>
                  <td className="p-2">{r.producer ?? ""}</td>
                  <td className="p-2">{r.pack_size ?? ""}</td>
                  <td className="p-2">{r.case_pack ?? ""}</td>
                  <td className="p-2 tabular">{r.wholesale_price ?? ""}</td>
                  <td className="p-2 tabular">{r.retail_price ?? ""}</td>
                  <td className="p-2">{r.unit ?? ""}</td>
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
        <summary>Expected column headers (any of these match — header row is case-insensitive)</summary>
        <div className="mt-1 leading-relaxed space-y-1">
          <p><strong>SKU</strong> (required): <code>SKU</code>, <code>Item</code>, <code>Item Name</code>, <code>Item Number</code>, <code>Number</code>, <code>Name</code>.</p>
          <p><strong>UPC</strong>: <code>UPC</code>, <code>Barcode</code>, <code>EAN</code>, <code>GTIN</code>.</p>
          <p><strong>Name</strong>: <code>Description</code>, <code>Sales Description</code>, <code>Item Description</code>.</p>
          <p><strong>Producer / farm</strong>: <code>Producer</code>, <code>Farm</code>, <code>Vendor</code>, <code>Supplier</code>, <code>Source</code>. (Shown on every product card.)</p>
          <p><strong>Pack size</strong>: <code>Pack Size</code>, <code>Pack</code>, <code>Size</code>. (Per-unit weight, e.g. &ldquo;10 LB&rdquo;.)</p>
          <p><strong>Case pack</strong>: <code>Case</code>, <code>Case Pack</code>, <code>Case Format</code>, <code>Pack Format</code>. (e.g. &ldquo;2X12LB AVG&rdquo;.)</p>
          <p><strong>Wholesale price</strong>: <code>Case Cost</code>, <code>Wholesale Cost</code>, <code>Wholesale Price</code>, <code>Price</code>, <code>Sales Price</code>, <code>Rate</code>, <code>Cost</code>. (B2B-specific headers take priority when multiple match.)</p>
          <p><strong>Retail price</strong>: <code>Retail</code>, <code>Retail Price</code>.</p>
          <p><strong>Unit</strong>: <code>Unit</code>, <code>U/M</code>, <code>UOM</code>, <code>Unit of Measure</code>.</p>
          <p><strong>Income account</strong>: <code>Account</code>, <code>Income Account</code>.</p>
          <p><strong>Category hint</strong>: <code>Category</code>, <code>Type</code>, <code>Item Type</code>. Auto-classified into beef / pork / produce / etc. when the item name contains a known keyword.</p>
          <p className="pt-1">Partial data is fine. Existing items match by SKU and update in place — missing CSV columns leave the existing values intact.</p>
        </div>
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
  // Preferred → fallback lookup. Returns the first key group that finds a
  // column, so B2B-specific headers like "Case Cost" take priority over
  // generic "Price" when both are present.
  const findPreferred = (...groups: string[][]): number => {
    for (const g of groups) {
      const idx = find(g);
      if (idx >= 0) return idx;
    }
    return -1;
  };
  const h = {
    sku: find(["item name", "item number", "sku", "item", "number", "name"]),
    upc: find(["upc", "barcode", "ean", "gtin"]),
    name: find(["description", "sales description", "item description"]),
    wholesale_price: findPreferred(
      ["case cost", "wholesale cost", "wholesale price", "wholesale"],
      ["sales price", "price", "rate", "cost"],
    ),
    retail_price: find(["retail"]),
    unit: find(["u/m", "uom", "unit of measure", "unit"]),
    pack_size: find(["pack size", "pack", "size"]),
    case_pack: find(["case pack", "case format", "pack format", "case"]),
    producer: find(["producer", "farm", "supplier", "source", "vendor"]),
    income_account: find(["income account", "account"]),
    category_hint: find(["type", "category", "item type"]),
    brand_hint: find(["manufacturer", "brand"]),
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
      upc: cells[h.upc]?.trim() || undefined,
      name: (cells[h.name]?.trim() || sku),
      wholesale_price: priceRaw && !isNaN(Number(priceRaw)) ? Number(priceRaw) : undefined,
      retail_price: retailRaw && !isNaN(Number(retailRaw)) ? Number(retailRaw) : undefined,
      unit: cells[h.unit]?.trim(),
      pack_size: cells[h.pack_size]?.trim(),
      case_pack: cells[h.case_pack]?.trim() || undefined,
      producer: cells[h.producer]?.trim() || undefined,
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
