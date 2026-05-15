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

/* Brief 7 V2 pictorial nav icons: clipboard (Guide), stacked crates
   (Catalog), farm truck (Orders), speech bubble (Chat — swapped in
   for the brief's tin-can-on-string per the failure-point flag;
   literal beats clever for nav recognition). Stroke 1.6 monoline.
   Each icon's primary mass is painted via a <g class="tab-icon-fill">
   that becomes visible at 14% opacity when the parent NavLink has
   data-active="true". Active stroke color = brand-blue via
   currentColor. See globals.css ".tab-icon-fill" + NavLink.tsx. */
function GuideIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <g fill="currentColor" stroke="none" className="tab-icon-fill">
        <rect x="5" y="4" width="14" height="17" rx="1.5" />
      </g>
      <rect x="5" y="4" width="14" height="17" rx="1.5" />
      <rect x="9" y="2.5" width="6" height="3" rx="0.8" fill="currentColor" stroke="none" />
      <path d="M8 11h8M8 14h8M8 17h5" />
    </svg>
  );
}
function CatalogIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <g fill="currentColor" stroke="none" className="tab-icon-fill">
        <rect x="3" y="13" width="8" height="7" rx="0.6" />
        <rect x="13" y="13" width="8" height="7" rx="0.6" />
        <rect x="8" y="5" width="8" height="7" rx="0.6" />
      </g>
      <rect x="3" y="13" width="8" height="7" rx="0.6" />
      <rect x="13" y="13" width="8" height="7" rx="0.6" />
      <rect x="8" y="5" width="8" height="7" rx="0.6" />
      <path d="M5 13v7M9 13v7M15 13v7M19 13v7M10 5v7M14 5v7" />
    </svg>
  );
}
function OrdersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <g fill="currentColor" stroke="none" className="tab-icon-fill">
        <rect x="2" y="8" width="11" height="9" rx="0.8" />
        <path d="M13 11h5l3 3v3h-8z" />
      </g>
      <rect x="2" y="8" width="11" height="9" rx="0.8" />
      <path d="M13 11h5l3 3v3h-8z" />
      <circle cx="7" cy="18.5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="17" cy="18.5" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <g fill="currentColor" stroke="none" className="tab-icon-fill">
        <path d="M4 6.5C4 5.12 5.12 4 6.5 4h11C18.88 4 20 5.12 20 6.5v8c0 1.38-1.12 2.5-2.5 2.5H11l-4 4v-4h-0.5C5.12 17 4 15.88 4 14.5v-8z" />
      </g>
      <path d="M4 6.5C4 5.12 5.12 4 6.5 4h11C18.88 4 20 5.12 20 6.5v8c0 1.38-1.12 2.5-2.5 2.5H11l-4 4v-4h-0.5C5.12 17 4 15.88 4 14.5v-8z" />
    </svg>
  );
}
