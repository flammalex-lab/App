export interface AccountingCustomer {
  id: string;
  name: string;               // matches QBD Customer:Job
  parentName?: string | null; // for chains (parent:child)
  email?: string | null;
  phone?: string | null;
  terms?: string | null;
  address?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  };
}

export interface AccountingLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;             // quantity * unitPrice
  incomeAccount: string;      // product-level override else category default
  memo?: string | null;
}

export interface AccountingInvoice {
  id: string;                 // portal order id
  refNumber: string;          // order_number, e.g. FLF-2026-0042
  customerName: string;       // QB customer reference
  date: Date;
  shipDate?: Date | null;
  terms: string;              // Net 30, etc.
  arAccount: string;          // A/R account from qb_settings
  lines: AccountingLineItem[];
  memo?: string | null;
}

export interface AccountingResult {
  ok: boolean;
  ref?: string;               // QBD invoice ref on success (Phase 2)
  error?: string;
}

export interface ExportBundle {
  filename: string;
  mimeType: string;
  body: string | Buffer;
  orderIds: string[];         // which orders were included
}

export interface DateRange {
  from: Date;
  to: Date;
}
