"use client";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { useProductSheet } from "@/lib/products/detail-sheet-store";
import { ProductDetailContent } from "@/app/(storefront)/catalog/[id]/ProductDetailContent";

/**
 * Mounts the Pepper-style client-state product detail modal at the
 * storefront layout level. Cards call `useProductSheet.getState().open(...)`
 * and the sheet opens immediately with the product's cached fields; a
 * thin inline skeleton fills the pack-rows area until the server
 * action resolves with priced packs.
 *
 * Replaces the parallel-route `@modal/(.)catalog/[id]` interception
 * pattern. Trade-off: the URL doesn't change to /catalog/[id], so the
 * modal isn't shareable or back-button-dismissible (an explicit
 * product decision — buyers don't share PDP URLs in this app's flows).
 * In exchange we get instant open with no body-lock thrash, no scroll
 * restoration to fight, no Suspense boundary handoff.
 */
export function ProductDetailSheet() {
  const product = useProductSheet((s) => s.product);
  const packs = useProductSheet((s) => s.packs);
  const isB2B = useProductSheet((s) => s.isB2B);
  const inGuide = useProductSheet((s) => s.inGuide);
  const groupedProductCount = useProductSheet((s) => s.groupedProductCount);
  const loading = useProductSheet((s) => s.loading);
  const close = useProductSheet((s) => s.close);

  if (!product) return null;

  return (
    <BottomSheet
      open
      onClose={close}
      ariaLabel={product.name}
      desktopMaxWidth="64rem"
      suppressEnterAnimation
    >
      {packs ? (
        <ProductDetailContent
          product={product}
          packs={packs}
          groupedProductCount={groupedProductCount}
          isB2B={isB2B}
          inGuide={inGuide}
          onClose={close}
        />
      ) : (
        /* First-paint state: ProductDetailContent's frame + producer/
           title/description show immediately; the pack rows are the
           only thing that needs server data, so render a thin in-place
           skeleton there. `loading` is true on the first call;
           false-with-packs=null means the action returned !ok (hidden
           SKU, auth fail, etc.) — show a quiet fallback so the buyer
           gets a close-able sheet rather than an empty backdrop. */
        <ProductDetailContentInstant
          product={product}
          groupedProductCount={groupedProductCount}
          loading={loading}
          onClose={close}
        />
      )}
    </BottomSheet>
  );
}

/**
 * Instant-paint version of the detail body. Renders everything the
 * card already knows about the product (image, producer, title, pack
 * caption, description if present, details if present) and shows a
 * pack-rows skeleton in place of the variant picker until the server
 * action returns.
 */
function ProductDetailContentInstant({
  product,
  groupedProductCount,
  loading,
  onClose,
}: {
  product: NonNullable<ReturnType<typeof useProductSheet.getState>["product"]>;
  groupedProductCount: number;
  loading: boolean;
  onClose: () => void;
}) {
  // Reuse ProductDetailContent's render but with packs=[] — it falls
  // back to the "Contact your rep for pricing" message when packs is
  // empty. We replace just that bit with the pack-rows skeleton (or a
  // small "unavailable" affordance if the action returned !ok).
  return (
    <ProductDetailContent
      product={product}
      packs={[]}
      groupedProductCount={groupedProductCount}
      isB2B={false}
      inGuide={false}
      onClose={onClose}
      // Render-time hook into the empty-packs branch — pass a custom
      // placeholder for the pack list area while loading. If loading
      // is false, packs is genuinely null (unauthorized / hidden /
      // not-found) and ProductDetailContent's built-in "Contact your
      // rep" message reads correctly.
      packsPlaceholder={loading ? <PackRowsSkeleton /> : null}
    />
  );
}

function PackRowsSkeleton() {
  return (
    <div className="mt-4 animate-pulse">
      <div className="card divide-y divide-black/8">
        {[0, 1, 2].map((i) => (
          <div key={i} className="p-3 flex items-center justify-between gap-3">
            <div className="space-y-1.5 flex-1">
              <div className="h-4 w-32 rounded bg-black/8" />
              <div className="h-3 w-20 rounded bg-black/8" />
            </div>
            <div className="h-9 w-24 rounded-full bg-black/10 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
