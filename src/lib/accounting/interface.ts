import type {
  AccountingCustomer,
  AccountingInvoice,
  AccountingResult,
  DateRange,
  ExportBundle,
} from "./types";

export interface AccountingService {
  name: string;

  /** Create or upsert a customer in the accounting system. */
  syncCustomer(customer: AccountingCustomer): Promise<AccountingResult>;

  /** Create an invoice for a single order. */
  createInvoice(invoice: AccountingInvoice): Promise<AccountingResult>;

  /** Phase 1 only: produce a downloadable export file for a batch of invoices. */
  buildExport?(invoices: AccountingInvoice[], range?: DateRange): Promise<ExportBundle>;
}
