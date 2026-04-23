"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function DeleteBuyerButton({
  profileId,
  accountId,
  hasOrders,
}: {
  profileId: string;
  accountId: string;
  hasOrders: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (hasOrders) {
    return (
      <div>
        <Button variant="danger" disabled>
          Delete buyer
        </Button>
        <p className="text-xs text-ink-tertiary mt-2">
          Buyer has past orders — delete is disabled so order history is
          preserved. Reassign or archive the orders first if you really need
          to remove this buyer.
        </p>
      </div>
    );
  }

  async function doDelete() {
    setDeleting(true);
    const res = await fetch(`/api/admin/buyers/${profileId}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      toast.push((await res.json()).error ?? "Delete failed", "error");
      return;
    }
    toast.push("Buyer deleted", "success");
    router.push(`/admin/accounts/${accountId}`);
  }

  if (!confirming) {
    return (
      <Button variant="danger" onClick={() => setConfirming(true)}>
        Delete buyer
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-feedback-error font-medium">This can&rsquo;t be undone.</span>
      <Button variant="ghost" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
      <Button variant="danger" onClick={doDelete} loading={deleting}>
        Yes, delete
      </Button>
    </div>
  );
}
