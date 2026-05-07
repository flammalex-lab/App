import Link from "next/link";
import { GROUP_LABELS, type ProductGroup } from "@/lib/constants";

/**
 * Horizontal scroll of category chips. Sits under the search bar on
 * /catalog landing. Each chip is a Link so the route fully refreshes
 * (server query re-runs) — keeps the implementation server-only.
 *
 * Active chip = the current ?group=X. Empty/undefined = "All" highlighted.
 */
export function CategoryChips({
  groups,
  active,
  className,
}: {
  /** Allowed groups for this buyer, with optional item counts. */
  groups: { group: ProductGroup; count?: number }[];
  active: ProductGroup | "explore" | "best" | null;
  className?: string;
}) {
  const all = [
    { key: null as null, label: "All" },
    ...groups.map((g) => ({ key: g.group, label: GROUP_LABELS[g.group] })),
    { key: "best" as const, label: "Best sellers" },
  ];

  return (
    <div
      className={`overflow-x-auto -mx-4 md:-mx-0 px-4 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className ?? ""}`}
      aria-label="Categories"
    >
      <div className="flex gap-1.5 min-w-max">
        {all.map((c) => {
          const isActive = active === c.key || (c.key === null && active === null);
          const href = c.key === null ? "/catalog" : `/catalog?group=${c.key}`;
          return (
            <Link
              key={c.key ?? "all"}
              href={href}
              className={
                isActive
                  ? "px-3.5 py-1.5 rounded-full bg-ink-primary text-white text-sm font-medium whitespace-nowrap transition"
                  : "px-3.5 py-1.5 rounded-full bg-white border border-black/10 text-ink-primary text-sm font-medium hover:border-black/20 hover:bg-bg-secondary whitespace-nowrap transition"
              }
            >
              {c.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
