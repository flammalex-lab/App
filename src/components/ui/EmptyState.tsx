import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared empty-state component. Avoids the half-dozen ad-hoc variants
 * ("Nothing yet", "No items", "No products match") that had drifted
 * across pages.
 *
 * Usage:
 *   <EmptyState title="Your cart is empty" cta={{ href: "/guide", label: "Browse your guide" }} />
 *   <EmptyState title={`No items match "${q}"`} />
 */
type Cta =
  | { href: string; label: string; variant?: "primary" | "secondary" }
  | { onClick: () => void; label: string; variant?: "primary" | "secondary" };

export function EmptyState({
  title,
  body,
  cta,
  icon,
  className,
}: {
  title: ReactNode;
  body?: ReactNode;
  cta?: Cta;
  icon?: ReactNode;
  className?: string;
}) {
  // Default keeps the existing secondary styling. Surfaces where the
  // CTA is the primary next-step (empty cart) pass variant: "primary".
  const ctaClass =
    cta && cta.variant === "primary" ? "btn-primary" : "btn-secondary";
  return (
    <div
      className={`py-10 px-4 text-center ${className ?? ""}`}
      role="status"
    >
      {icon ? <div className="mb-3 flex justify-center text-ink-tertiary">{icon}</div> : null}
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
