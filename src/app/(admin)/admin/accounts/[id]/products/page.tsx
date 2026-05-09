import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/server";
import type { Account, AccountProduct, Product } from "@/lib/supabase/types";
import { AccountVisibilityEditor } from "./AccountVisibilityEditor";

export default async function AccountVisibilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const svc = createServiceClient();

  const { data: account } = await svc.from("accounts").select("*").eq("id", id).maybeSingle();
  if (!account) notFound();

  // Show every private product so the admin can curate from one place. Public
  // products are visible to everyone and don't need explicit allow-listing.
  const [{ data: products }, { data: allowed }] = await Promise.all([
    svc
      .from("products")
      .select("*")
      .eq("private", true)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    svc.from("account_products").select("*").eq("account_id", id),
  ]);

  return (
    <div className="max-w-3xl">
      <Link href={`/admin/accounts/${id}`} className="text-sm text-ink-secondary hover:underline">
        ← {(account as Account).name}
      </Link>
      <h1 className="text-3xl mt-1 mb-1">Visible products</h1>
      <p className="text-sm text-ink-secondary mb-4">
        Choose which private SKUs this account can see and order. Public products
        are visible to every account and don&rsquo;t appear here.
      </p>
      <AccountVisibilityEditor
        accountId={id}
        products={(products as Product[] | null) ?? []}
        allowed={(allowed as AccountProduct[] | null) ?? []}
      />
    </div>
  );
}
