"use client";

import { useRouter } from "next/navigation";
import type { Product } from "@/lib/supabase/types";
import { type PackRow } from "@/app/(storefront)/catalog/[id]/ProductDetailClient";
import { ProductDetailContent } from "@/app/(storefront)/catalog/[id]/ProductDetailContent";
import { BottomSheet } from "@/components/ui/BottomSheet";

export function ProductModal({
  product,
  packs,
  showAddToGuide,
  inGuideInitial,
}: {
  product: Product;
  packs: PackRow[];
  showAddToGuide: boolean;
  inGuideInitial: boolean;
}) {
  const router = useRouter();
  const close = () => router.back();

  return (
    <BottomSheet open onClose={close} ariaLabel={product.name} desktopMaxWidth="64rem">
      <ProductDetailContent
        product={product}
        packs={packs}
        isB2B={showAddToGuide}
        inGuide={inGuideInitial}
        onClose={close}
      />
    </BottomSheet>
  );
}
