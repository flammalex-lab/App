import { ImportClient } from "./ImportClient";

export const metadata = { title: "Admin — Import customers" };

export default function ImportPage() {
  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl mb-2">Import customers from QuickBooks</h1>
      <p className="text-sm text-ink-secondary mb-4">
        One-time pull: export your Customer list from QuickBooks Desktop (Reports → Customer &amp; Receivables →
        Customer Contact List → Excel/CSV) and upload it here. We&apos;ll create accounts with the QB
        Customer:Job name pre-filled so orders flow back cleanly.
      </p>
      <ImportClient />
    </div>
  );
}
