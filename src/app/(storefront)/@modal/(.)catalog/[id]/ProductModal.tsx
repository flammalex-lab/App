"use client";

import { useRouter } from "next/navigation";
import type { Product } from "@/lib/supabase/types";
import { type PackRow } from "@/app/(storefront)/catalog/[id]/ProductDetailClient";
import { ProductDetailContent } from "@/app/(storefront)/catalog/[id]/ProductDetailContent";
import { BottomSheet } from "@/components/ui/BottomSheet";

export function ProductModal({
  product,
  packs,
  groupedProductCount,
  showAddToGuide,
  inGuideInitial,
}: {
  product: Product;
  packs: PackRow[];
  groupedProductCount: number;
  showAddToGuide: boolean;
  inGuideInitial: boolean;
}) {
  const router = useRouter();
  const close = () => router.back();

  // Earlier this component had a pathname-watch effect that called
  // router.back() whenever pathname changed away from /catalog/[id].
  // It actively defeated the "Go to cart" fix: replacing the URL with
  // /cart fired the watcher → back() → buyer landed somewhere upstream
  // of /cart instead of on /cart. The parallel-route slot already
  // collapses to default.tsx (null) on navigation to any route that
  // doesn't match @modal/(.)catalog/[id], so the watcher was redundant
  // belt-and-braces anyway. Removed.

  return (
    <BottomSheet open onClose={close} ariaLabel={product.name} desktopMaxWidth="64rem" suppressEnterAnimation>
      <ProductDetailContent
        product={product}
        packs={packs}
        groupedProductCount={groupedProductCount}
        isB2B={showAddToGuide}
        inGuide={inGuideInitial}
        onClose={close}
      />
    </BottomSheet>
  );
}
