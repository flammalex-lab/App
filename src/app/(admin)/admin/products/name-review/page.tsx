import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NameReviewClient } from "./NameReviewClient";

export const metadata = { title: "Admin — Name review" };

export default async function NameReviewPage() {
  const db = await createClient();
  const { count: pendingCount } = await db
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .eq("needs_naming_review", true);

  return (
    <div className="max-w-5xl">
      <div className="flex items-baseline gap-3 mb-2">
        <h1 className="text-3xl">Name review</h1>
        <Link href="/admin/products" className="text-sm text-ink-secondary underline">
          ← back to products
        </Link>
      </div>
      <p className="text-sm text-ink-secondary mb-4">
        Round-trip flow for finalizing buyer-facing names + pack sizes.
        Export the pending list, edit in your spreadsheet, set
        <code className="mx-1 text-xs bg-bg-secondary px-1 rounded">needs_naming_review</code>
        to <code className="text-xs">false</code> on rows you&apos;re happy with, then re-upload.
        The <code className="text-xs">id</code> column is the join key — don&apos;t edit it.
      </p>
      <NameReviewClient pendingCount={pendingCount ?? 0} />
    </div>
  );
}
