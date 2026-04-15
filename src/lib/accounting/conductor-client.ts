import type { AccountingService } from "./interface";
import type {
  AccountingCustomer,
  AccountingInvoice,
  AccountingResult,
} from "./types";

/**
 * Phase 2 accounting provider (stub). Live-syncs to QuickBooks Desktop via
 * Conductor (conductor.is). Wire up the real SDK in Phase 2.
 *
 *   import { Conductor } from "conductor-node";
 *   const client = new Conductor(process.env.CONDUCTOR_API_KEY);
 *   await client.qbd.invoices.create({ ... });
 */
export const conductorService: AccountingService = {
  name: "conductor",

  async syncCustomer(_customer: AccountingCustomer): Promise<AccountingResult> {
    if (!process.env.CONDUCTOR_API_KEY) {
      return { ok: false, error: "CONDUCTOR_API_KEY is not configured" };
    }
    return { ok: false, error: "Conductor live sync is stubbed — implement in Phase 2" };
  },

  async createInvoice(_invoice: AccountingInvoice): Promise<AccountingResult> {
    if (!process.env.CONDUCTOR_API_KEY) {
      return { ok: false, error: "CONDUCTOR_API_KEY is not configured" };
    }
    return { ok: false, error: "Conductor live sync is stubbed — implement in Phase 2" };
  },
};
