import { ItemsImportClient } from "./ItemsImportClient";

export const metadata = { title: "Admin — Import items from QuickBooks" };

export default function ItemsImportPage() {
  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl mb-2">Import items from QuickBooks</h1>
      <p className="text-sm text-ink-secondary mb-4">
        Export your Item List from QuickBooks Desktop (<strong>Reports → List → Item Listing → Export → Excel/CSV</strong>)
        and upload it here. The importer matches existing products by SKU (Item Name/Number),
        updates prices + descriptions if they&apos;ve changed, and inserts anything new.
        Admin-edited fields like images are preserved on updates.
      </p>
      <ItemsImportClient />
    </div>
  );
}
