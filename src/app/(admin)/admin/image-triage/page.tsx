import { requireAdmin } from "@/lib/auth/session";
import { ImageTriageClient } from "./ImageTriageClient";

export const metadata = { title: "Admin — Image triage" };

export default async function ImageTriagePage() {
  await requireAdmin();
  return (
    <div className="max-w-4xl">
      <h1 className="display text-3xl mb-2">Image triage</h1>
      <p className="text-sm text-ink-secondary mb-6">
        Drop in a batch of product photos. Filenames containing a SKU auto-match;
        unlabeled images get sent to Claude with a producer filter so you only
        review what it couldn&rsquo;t place automatically. Confirming writes the
        photo to the <code>product-images</code> bucket and updates the product.
      </p>
      <ImageTriageClient />
    </div>
  );
}
