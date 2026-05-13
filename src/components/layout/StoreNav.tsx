import Link from "next/link";
import { CartIconWithBadge } from "./CartIconWithBadge";
import { BrandLogo } from "@/components/Brand";
import { AccountSwitcher } from "./AccountSwitcher";
import { ProfileAvatar } from "./ProfileAvatar";
import { NavLink } from "./NavLink";
import { ScrollHideHeader } from "./ScrollHideHeader";
import { BottomTabs, type NavTab } from "./BottomTabs";
import { MobileHeader } from "./MobileHeader";
import type { Account, Profile } from "@/lib/supabase/types";

interface SerializedNextDelivery {
  deliveryDate: string;
  cutoffAt: string;
  deliveryDayName: string;
}

interface StoreNavProps {
  profile: Profile;
  activeAccount: Account | null;
  memberships: Account[];
  next: SerializedNextDelivery | null;
}

/**
 * Responsive shell:
 *   - Mobile: 52px MobileHeader (page title + cutoff + overflow) + bottom tab bar.
 *     Cart access on mobile lives in StickyCartBar, not the header.
 *   - md+:    Desktop header strip (logo · nav · account · cart · profile);
 *             bottom tabs hide.
 *
 * B2B buyers home on /guide; DTC customers on /catalog.
 */
export function StoreNav({ profile, activeAccount, memberships, next }: StoreNavProps) {
  const isB2B = profile.role === "b2b_buyer";
  const home = isB2B ? "/guide" : "/catalog";
  const tabs = navTabs(isB2B);
  return (
    <>
      <ScrollHideHeader>
        <MobileHeader
          home={home}
          profile={profile}
          activeAccount={activeAccount}
          memberships={memberships}
          next={next}
        />
        <DesktopHeader
          home={home}
          tabs={tabs}
          profile={profile}
          activeAccount={activeAccount}
          memberships={memberships}
        />
      </ScrollHideHeader>
      <BottomTabs tabs={tabs} />
    </>
  );
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

function DesktopHeader({
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
    <header className="hidden md:block bg-white/80 backdrop-blur-md border-b border-black/[0.06] supports-[backdrop-filter]:bg-white/70">
      <div className="flex items-center gap-2 px-6 py-1.5">
        <Link href={home} className="shrink-0" aria-label="Home">
          <BrandLogo size={28} />
        </Link>

        <nav className="flex items-center gap-1 ml-4">
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

        <div className="flex-1 min-w-0 flex justify-end pr-2">
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
