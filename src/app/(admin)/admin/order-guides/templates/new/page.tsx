import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { NewTemplateForm } from "./NewTemplateForm";

export const metadata = { title: "Admin — New template" };

export default async function NewTemplatePage() {
  await requireAdmin();
  return (
    <div className="max-w-2xl space-y-4">
      <Link
        href="/admin/order-guides/templates"
        className="text-sm text-ink-secondary hover:underline"
      >
        ← Templates
      </Link>
      <h1 className="display text-3xl">New template</h1>
      <p className="text-sm text-ink-secondary">
        Give it a name like <em>Produce</em> or <em>Lincoln Market Dairy</em>.
        You&rsquo;ll curate the items on the next screen.
      </p>
      <NewTemplateForm />
    </div>
  );
}
