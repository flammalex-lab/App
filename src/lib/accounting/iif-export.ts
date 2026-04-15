import type { AccountingService } from "./interface";
import type {
  AccountingCustomer,
  AccountingInvoice,
  AccountingResult,
  ExportBundle,
} from "./types";

/**
 * Phase 1 accounting provider: builds a QuickBooks IIF file for admin to
 * import via File → Utilities → Import → IIF Files.
 *
 * IIF is tab-delimited. Each invoice is one TRNS row (total AR debit) +
 * one SPL row per line item (income account credit) + one ENDTRNS marker.
 *
 * Transaction convention (matches QBD's import tool):
 *   TRNS amount  = positive (debit to A/R)
 *   SPL amounts  = negative (credits to income accounts)
 *   sum(TRNS + SPLs) = 0
 */
export const iifExportService: AccountingService = {
  name: "iif",

  async syncCustomer(_customer: AccountingCustomer): Promise<AccountingResult> {
    // No-op in file-based mode. Customers are created in QBD directly or via
    // the one-time customer-import flow at launch.
    return { ok: true };
  },

  async createInvoice(_invoice: AccountingInvoice): Promise<AccountingResult> {
    // No-op — invoices are emitted as a batch via buildExport().
    return { ok: true };
  },

  async buildExport(invoices: AccountingInvoice[]): Promise<ExportBundle> {
    const body = renderIIF(invoices);
    const dateTag = new Date().toISOString().slice(0, 10);
    return {
      filename: `flf-qb-export-${dateTag}.iif`,
      mimeType: "text/plain",
      body,
      orderIds: invoices.map((i) => i.id),
    };
  },
};

function renderIIF(invoices: AccountingInvoice[]): string {
  const out: string[] = [];
  // Headers
  out.push(
    ["!TRNS", "TRNSID", "TRNSTYPE", "DATE", "ACCNT", "NAME", "AMOUNT", "DOCNUM", "MEMO", "TERMS"].join("\t"),
  );
  out.push(
    ["!SPL", "SPLID", "TRNSTYPE", "DATE", "ACCNT", "NAME", "AMOUNT", "MEMO"].join("\t"),
  );
  out.push("!ENDTRNS");

  for (const inv of invoices) {
    const total = round2(inv.lines.reduce((s, l) => s + l.amount, 0));
    out.push(
      [
        "TRNS",
        "",
        "INVOICE",
        fmtDate(inv.date),
        inv.arAccount,
        inv.customerName,
        total.toFixed(2),
        inv.refNumber,
        inv.memo ?? "",
        inv.terms,
      ].join("\t"),
    );
    for (const line of inv.lines) {
      out.push(
        [
          "SPL",
          "",
          "INVOICE",
          fmtDate(inv.date),
          line.incomeAccount,
          inv.customerName,
          (-round2(line.amount)).toFixed(2),
          [line.description, line.memo].filter(Boolean).join(" — "),
        ].join("\t"),
      );
    }
    out.push("ENDTRNS");
  }

  return out.join("\n") + "\n";
}

export function buildCSVExport(invoices: AccountingInvoice[]): ExportBundle {
  const rows: string[][] = [
    [
      "Invoice #",
      "Customer",
      "Date",
      "Ship Date",
      "Terms",
      "Item Description",
      "Qty",
      "Unit Price",
      "Amount",
      "Income Account",
    ],
  ];
  for (const inv of invoices) {
    for (const line of inv.lines) {
      rows.push([
        inv.refNumber,
        inv.customerName,
        fmtDate(inv.date),
        inv.shipDate ? fmtDate(inv.shipDate) : "",
        inv.terms,
        line.description,
        line.quantity.toString(),
        line.unitPrice.toFixed(2),
        line.amount.toFixed(2),
        line.incomeAccount,
      ]);
    }
  }
  const body = rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
  const dateTag = new Date().toISOString().slice(0, 10);
  return {
    filename: `flf-qb-export-${dateTag}.csv`,
    mimeType: "text/csv",
    body,
    orderIds: invoices.map((i) => i.id),
  };
}

function csvCell(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function fmtDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
