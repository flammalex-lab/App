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
 * On md+ it hides entirely.
 *
 * Active tab gets a 3px brand-blue underline anchored to the TOP of
 * the tab cell (per brief 02 — visually quiet "floor" treatment) and
 * brand-blue text + icon. No background swatch.
 */
export function BottomTabs({ tabs }: { tabs: NavTab[] }) {
  const hidden = useScrollHidden();
  return (
    <div
      className={`fixed bottom-0 inset-x-0 z-[35] bg-white border-t border-black/10 shadow-sticky pb-safe md:hidden transition-transform duration-200 will-change-transform ${
        hidden ? "translate-y-full" : "translate-y-0"
      }`}
    >
      <nav
        className="mx-auto max-w-3xl grid text-[10px] font-semibold"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((t) => (
          <NavLink
            key={t.href}
            href={t.href}
            className="relative flex flex-col items-center justify-center gap-0.5 pt-2.5 pb-1.5 text-ink-tertiary active:bg-bg-secondary transition-colors duration-150 before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-9 before:h-[3px] before:rounded-b-[3px] before:bg-brand-blue before:opacity-0 before:transition-opacity before:duration-150 motion-reduce:before:transition-none"
            activeClassName="!text-brand-blue before:!opacity-100"
          >
            <span className="h-[22px] w-[22px]">{t.icon}</span>
            <span className="leading-none">{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
