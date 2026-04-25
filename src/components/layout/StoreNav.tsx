import Link from "next/link";
import { CartIconWithBadge } from "./CartIconWithBadge";
import { BrandLogo } from "@/components/Brand";
import { AccountSwitcher } from "./AccountSwitcher";
import { ProfileAvatar } from "./ProfileAvatar";
import { NavLink } from "./NavLink";
import type { Account, Profile } from "@/lib/supabase/types";

interface StoreNavProps {
  profile: Profile;
  activeAccount: Account | null;
  memberships: Account[];
}

/**
 * Responsive shell:
 *   - Mobile: top header (logo · account · cart · profile) + bottom tab bar.
 *   - md+:    top header grows a horizontal nav strip; bottom tabs hide.
 *
 * B2B buyers home on /guide; DTC customers on /catalog. The DTC layout
 * previously had both "Shop" and "Catalog" tabs pointing to /catalog —
 * collapsed to a single "Catalog" tab.
 */
export function StoreNav({ profile, activeAccount, memberships }: StoreNavProps) {
  const isB2B = profile.role === "b2b_buyer";
  const home = isB2B ? "/guide" : "/catalog";
  const tabs = navTabs(isB2B);
  return (
    <>
      <TopHeader
        home={home}
        tabs={tabs}
        profile={profile}
        activeAccount={activeAccount}
        memberships={memberships}
      />
      <BottomTabs tabs={tabs} />
    </>
  );
}

interface NavTab {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function navTabs(isB2B: boolean): NavTab[] {
  return isB2B
    ? [
        { href: "/guide", label: "Guide", icon: <GuideIcon /> },
        { href: "/catalog", label: "Catalog", icon: <CatalogIcon /> },
        { href: "/orders", label: "Orders", icon: <OrdersIcon /> },
        { href: "/chat", label: "Chat", icon: <ChatIcon /> },
      ]
    : [
        { href: "/catalog", label: "Catalog", icon: <CatalogIcon /> },
        { href: "/orders", label: "Orders", icon: <OrdersIcon /> },
        { href: "/chat", label: "Chat", icon: <ChatIcon /> },
      ];
}

function TopHeader({
  home,
  tabs,
  profile,
  activeAccount,
  memberships,
}: {
  home: string;
  tabs: NavTab[];
  profile: Profile;
  activeAccount: Account | null;
  memberships: Account[];
}) {
  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-black/[0.06] supports-[backdrop-filter]:bg-white/70">
      <div className="flex items-center gap-2 px-3 md:px-6 py-1.5">
        <Link href={home} className="shrink-0" aria-label="Home">
          <BrandLogo size={28} />
        </Link>

        {/* Desktop horizontal nav strip — hidden on mobile */}
        <nav className="hidden md:flex items-center gap-1 ml-4">
          {tabs.map((t) => (
            <NavLink
              key={t.href}
              href={t.href}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-ink-secondary hover:text-ink-primary hover:bg-bg-secondary transition-colors duration-150"
              activeClassName="!text-ink-primary !bg-bg-secondary"
            >
              <span className="h-4 w-4">{t.icon}</span>
              {t.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex-1 min-w-0 flex justify-center md:justify-end md:pr-2">
          {activeAccount ? (
            <AccountSwitcher active={activeAccount} memberships={memberships} />
          ) : null}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <CartIconWithBadge />
          <ProfileAvatar profile={profile} />
        </div>
      </div>
    </header>
  );
}

function BottomTabs({ tabs }: { tabs: NavTab[] }) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-black/10 shadow-sticky pb-safe md:hidden">
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

function GuideIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4V4Z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}
function CatalogIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function OrdersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-11.8 7L4 20l1-4.6A8 8 0 1 1 21 12Z" />
    </svg>
  );
}
