import Image from "next/image";

/**
 * Catalog layout. Holds the editorial hero so it persists across
 * `?group=`/`?subCategory=`/`?producer=` query changes — Next App Router
 * keeps layouts mounted while only the page body re-renders, so navigating
 * between e.g. `/catalog` and `/catalog?group=dairy` reads as a filter
 * change rather than a full page nav.
 *
 * Buyer feedback (M27): "When you go into a group on the catalog, I want
 * it to flow more seamlessly. I'd prefer it barely look like a page
 * change. Keeping the image there might be enough."
 *
 * Detail views (producer drill-in, sub-category drill-in) still render
 * their own centered editorial hero in page.tsx beneath this — that's
 * intentional: the photo hero gives parent context, the editorial title
 * gives the focused subject.
 */
export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-screen-xl mx-auto pb-8">
      {/* Editorial hero — kept compact for now since it isn't
          interactive. Single full-bleed photo with restrained overlay
          text; will get its own click-through treatment later.

          M23: next/image with fill + priority — LCP candidate on the
          catalog landing, so eager-load + use the image optimizer. */}
      <section className="relative overflow-hidden md:rounded-2xl mb-4 mx-0 md:mx-0">
        <div className="relative aspect-[16/4] md:aspect-[24/5]">
          <Image
            src="/images/IMG_7794-scaled-3.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/30 to-black/10" />
          <div className="absolute inset-x-0 bottom-0 p-3 md:p-5 text-white">
            <p className="display text-lg md:text-2xl tracking-tight leading-tight drop-shadow">
              This week from Fingerlakes Farms
            </p>
            <p className="text-[11px] md:text-sm text-white/85 mt-0.5 drop-shadow">
              Trust our process. Trust your food.
            </p>
          </div>
        </div>
      </section>
      {children}
    </div>
  );
}
