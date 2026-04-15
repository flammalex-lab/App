import type { AccountingService } from "./interface";
import { iifExportService } from "./iif-export";
import { conductorService } from "./conductor-client";

export * from "./types";
export type { AccountingService } from "./interface";

/**
 * Returns the configured accounting service. Swap transport in env
 * (ACCOUNTING_PROVIDER=iif | conductor). All code outside this folder
 * imports only from here.
 */
export function getAccountingService(): AccountingService {
  const provider = (process.env.ACCOUNTING_PROVIDER ?? "iif").toLowerCase();
  switch (provider) {
    case "conductor":
      return conductorService;
    case "iif":
    default:
      return iifExportService;
  }
}
