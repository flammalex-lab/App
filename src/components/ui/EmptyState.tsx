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
export function EmptyState({
  title,
  body,
  cta,
  icon,
  className,
}: {
  title: ReactNode;
  body?: ReactNode;
  cta?: { href: string; label: string } | { onClick: () => void; label: string };
  icon?: ReactNode;
  className?: string;
}) {
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
          <Link href={cta.href} className="mt-3 inline-block btn-secondary text-sm">
            {cta.label}
          </Link>
        ) : (
          <button onClick={cta.onClick} className="mt-3 btn-secondary text-sm">
            {cta.label}
          </button>
        )
      ) : null}
    </div>
  );
}
