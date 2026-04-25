"use client";

import { NavLink } from "./NavLink";
import { useScrollHidden } from "./ScrollHideHeader";

export interface NavTab {
  href: string;
  label: string;
  icon: React.ReactNode;
}

/**
 * Bottom tab bar (mobile only). Slides off the bottom edge on scroll-
 * down, returns on any scroll-up — same behavior as the top header.
 * On md+ stays pinned (md:hidden hides it entirely on desktop, but
 * we keep the translate-y-0 override anyway in case that changes).
 */
export function BottomTabs({ tabs }: { tabs: NavTab[] }) {
  const hidden = useScrollHidden();
  return (
    <div
      className={`fixed bottom-0 inset-x-0 z-30 bg-white border-t border-black/10 shadow-sticky pb-safe md:hidden transition-transform duration-200 will-change-transform ${
        hidden ? "translate-y-full" : "translate-y-0"
      }`}
    >
      <nav
        className="mx-auto max-w-3xl grid text-[11px]"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((t) => (
          <NavLink
            key={t.href}
            href={t.href}
            className="flex flex-col items-center justify-center gap-0.5 pt-2 pb-2 text-ink-secondary hover:text-brand-blue active:bg-bg-secondary transition-colors duration-150"
            activeClassName="!text-ink-primary"
          >
            <span className="h-5 w-5">{t.icon}</span>
            <span className="leading-none">{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
