import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Shared empty-state component. Avoids the half-dozen ad-hoc variants
 * ("Nothing yet", "No items", "No products match") that had drifted
 * across pages.
 *
 * Two visual modes:
 *   - icon  : muted neutral glyph (default). Used by surfaces where an
 *             empty state is mid-task — search returns 0, no results
 *             for a filter, etc.
 *   - image : a farm photo at 16:9 with optional caption pill. Used by
 *             the 3 "no activity yet" surfaces — /orders, /standing,
 *             /cart — where Brief 5 V1 calls for warmth, not
 *             instruction. Renders either-or with icon; image wins
 *             when both are set.
 *
 * Usage:
 *   <EmptyState title="Your cart is empty" cta={{ href: "/guide", label: "Browse your guide" }} />
 *   <EmptyState image="/photos/farm-3.jpg" imageCaption="Wednesday · 6:14am" title="Nothing on the truck yet." />
 */
type Cta =
  | { href: string; label: string; variant?: "primary" | "secondary" }
  | { onClick: () => void; label: string; variant?: "primary" | "secondary" };

export function EmptyState({
  title,
  body,
  cta,
  icon,
  image,
  imageAlt,
  imageCaption,
  className,
}: {
  title: ReactNode;
  body?: ReactNode;
  cta?: Cta;
  icon?: ReactNode;
  /** Public path to a photo (e.g. "/photos/farm-3.jpg"). When set,
   *  renders a 16:9 hero above the title and the `icon` prop is
   *  ignored. The empty-state copy lives in the page so wording can
   *  differ per surface. */
  image?: string;
  imageAlt?: string;
  /** Optional small overlay pill at the bottom-left of the photo —
   *  e.g. "Wednesday · 6:14am" for an upcoming-delivery empty. */
  imageCaption?: string;
  className?: string;
}) {
  const ctaClass =
    cta && cta.variant === "primary" ? "btn-primary" : "btn-secondary";
  return (
    <div
      className={`py-10 px-4 text-center ${className ?? ""}`}
      role="status"
    >
      {image ? (
        <div className="mx-auto mb-5 w-full max-w-sm md:max-w-md">
          <div className="relative aspect-[16/9] overflow-hidden rounded-xl shadow-[0_1px_2px_rgba(22,22,22,0.04)] ring-1 ring-black/[0.04]">
            <Image
              src={image}
              alt={imageAlt ?? ""}
              fill
              sizes="(max-width: 768px) 80vw, 28rem"
              className="object-cover"
              priority={false}
            />
            {imageCaption ? (
              <span className="absolute bottom-2.5 left-2.5 inline-flex items-center rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-ink-primary shadow-sm">
                {imageCaption}
              </span>
            ) : null}
          </div>
        </div>
      ) : icon ? (
        <div className="mb-3 flex justify-center text-ink-tertiary">{icon}</div>
      ) : null}
      <p className="text-sm font-medium text-ink-primary">{title}</p>
      {body ? <p className="mt-1 text-xs text-ink-secondary">{body}</p> : null}
      {cta ? (
        "href" in cta ? (
          <Link href={cta.href} className={`mt-3 inline-block ${ctaClass} text-sm`}>
            {cta.label}
          </Link>
        ) : (
          <button onClick={cta.onClick} className={`mt-3 ${ctaClass} text-sm`}>
            {cta.label}
          </button>
        )
      ) : null}
    </div>
  );
}
