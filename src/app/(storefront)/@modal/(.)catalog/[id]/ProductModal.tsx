"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  const pathname = usePathname();
  const close = () => router.back();

  // Belt-and-braces: if the URL ever changes to something that isn't
  // this modal route, dismiss the overlay. The "Go to cart" button now
  // calls onClose explicitly (primary fix), but a stray Link/router.push
  // from inside the sheet body would otherwise leave the overlay
  // floating above the new page.
  const initialPath = useRef(pathname);
  useEffect(() => {
    if (pathname !== initialPath.current) {
      router.back();
    }
  }, [pathname, router]);

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
