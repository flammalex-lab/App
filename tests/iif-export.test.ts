import { iifExportService, buildCSVExport } from "@/lib/accounting/iif-export";
import type { AccountingInvoice } from "@/lib/accounting/types";

const baseInvoice = (over: Partial<AccountingInvoice> = {}): AccountingInvoice => ({
  id: "ord_1",
  refNumber: "FLF-2026-0042",
  customerName: "Demo Restaurant",
  date: new Date("2026-04-15T12:00:00Z"),
  terms: "Net 30",
  arAccount: "1200 - Accounts Receivable",
  lines: [
    {
      description: "Grass-fed ribeye",
      quantity: 4,
      unitPrice: 18.5,
      amount: 74.0,
      incomeAccount: "Income:Beef",
    },
  ],
  ...over,
});

function lines(body: string): string[] {
  return body.split("\n").filter(Boolean);
}

describe("IIF export — formatting", () => {
  it("emits TRNS + SPL + ENDTRNS markers per invoice", async () => {
    const bundle = await iifExportService.buildExport!([baseInvoice()]);
    const ls = lines(bundle.body as string);
    expect(ls[0]).toMatch(/^!TRNS\t/);
    expect(ls[1]).toMatch(/^!SPL\t/);
    expect(ls[2]).toBe("!ENDTRNS");
    expect(ls.find((l) => l.startsWith("TRNS\t"))).toBeDefined();
    expect(ls.find((l) => l.startsWith("SPL\t"))).toBeDefined();
    expect(ls.find((l) => l === "ENDTRNS")).toBeDefined();
  });

  it("balances TRNS amount against summed SPL credits (sum-to-zero)", async () => {
    const inv = baseInvoice({
      lines: [
        { description: "A", quantity: 1, unitPrice: 10, amount: 10, incomeAccount: "Income:Foo" },
        { description: "B", quantity: 2, unitPrice: 5, amount: 10, incomeAccount: "Income:Bar" },
      ],
    });
    const bundle = await iifExportService.buildExport!([inv]);
    const ls = lines(bundle.body as string);
    const trns = ls.find((l) => l.startsWith("TRNS\t"))!;
    const spls = ls.filter((l) => l.startsWith("SPL\t"));
    const trnsAmount = Number(trns.split("\t")[6]);
    const splTotal = spls.reduce((s, row) => s + Number(row.split("\t")[6]), 0);
    expect(trnsAmount + splTotal).toBeCloseTo(0, 2);
  });
});

describe("IIF export — escaping (audit M7)", () => {
  it("scrubs tabs in customer name so they can't shred the row", async () => {
    const bundle = await iifExportService.buildExport!([
      baseInvoice({ customerName: "Smith\tCo" }),
    ]);
    const trns = lines(bundle.body as string).find((l) => l.startsWith("TRNS\t"))!;
    // The TRNS row has 9 tab-separated fields; if the tab in customer name
    // wasn't scrubbed, we'd see 10 fields.
    expect(trns.split("\t").length).toBe(10); // TRNS + 9 fields
    expect(trns).toContain("Smith Co");
    expect(trns).not.toContain("Smith\tCo");
  });

  it("scrubs newlines in description so they can't break record boundaries", async () => {
    const bundle = await iifExportService.buildExport!([
      baseInvoice({
        lines: [
          {
            description: "Line\nwith\nbreaks",
            quantity: 1,
            unitPrice: 10,
            amount: 10,
            incomeAccount: "Income:Foo",
          },
        ],
      }),
    ]);
    const ls = lines(bundle.body as string);
    // Should be exactly: !TRNS, !SPL, !ENDTRNS, TRNS, SPL, ENDTRNS = 6 lines.
    // If newlines weren't scrubbed, we'd see extra split lines.
    expect(ls.length).toBe(6);
  });

  it("scrubs CR characters", async () => {
    const bundle = await iifExportService.buildExport!([
      baseInvoice({ memo: "ship\rby\rfriday" }),
    ]);
    const trns = lines(bundle.body as string).find((l) => l.startsWith("TRNS\t"))!;
    expect(trns).not.toContain("\r");
    expect(trns).toContain("ship by friday");
  });
});

describe("CSV export — escaping", () => {
  it("quotes a field containing commas", () => {
    const bundle = buildCSVExport([baseInvoice({ customerName: "Smith, Inc." })]);
    expect(bundle.body).toContain('"Smith, Inc."');
  });

  it("doubles inner quotes", () => {
    const bundle = buildCSVExport([baseInvoice({ customerName: 'Joe "Big" Smith' })]);
    expect(bundle.body).toContain('"Joe ""Big"" Smith"');
  });

  it("quotes fields containing newlines", () => {
    const bundle = buildCSVExport([
      baseInvoice({
        lines: [
          {
            description: "Line\nwith newline",
            quantity: 1,
            unitPrice: 10,
            amount: 10,
            incomeAccount: "Income:Foo",
          },
        ],
      }),
    ]);
    // CSV preserves newlines inside quoted fields — exporters expect this.
    expect(bundle.body).toContain('"Line\nwith newline"');
  });

  it("emits a header row", () => {
    const bundle = buildCSVExport([baseInvoice()]);
    expect(bundle.body.split("\n")[0]).toBe(
      "Invoice #,Customer,Date,Ship Date,Terms,Item Description,Qty,Unit Price,Amount,Income Account",
    );
  });
});
