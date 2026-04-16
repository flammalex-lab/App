import Link from "next/link";
import { CartIconWithBadge } from "./CartIconWithBadge";
import { BrandLogo } from "@/components/Brand";
import { AccountSwitcher } from "./AccountSwitcher";
import { ProfileAvatar } from "./ProfileAvatar";
import { ViewOrderBar } from "./ViewOrderBar";
import type { Account, Profile } from "@/lib/supabase/types";

interface StoreNavProps {
  profile: Profile;
  activeAccount: Account | null;
  memberships: Account[];
}

/**
 * Top header: logo (home) · account switcher (center) · cart + profile (right)
 * Bottom tabs: Guide · Catalog · Orders · Chat   (B2B)
 *              Shop  · Catalog · Orders · Chat   (DTC)
 * Account moves to the profile sheet (top-right avatar) — Pepper-style.
 */
export function StoreNav({ profile, activeAccount, memberships }: StoreNavProps) {
  const isB2B = profile.role === "b2b_buyer";
  const home = isB2B ? "/guide" : "/catalog";
  return (
    <>
      <TopHeader
        home={home}
        profile={profile}
        activeAccount={activeAccount}
        memberships={memberships}
      />
      <BottomTabs isB2B={isB2B} />
    </>
  );
}

function TopHeader({
  home,
  profile,
  activeAccount,
  memberships,
}: {
  home: string;
  profile: Profile;
  activeAccount: Account | null;
  memberships: Account[];
}) {
  return (
    <header className="sticky top-0 z-30 bg-bg-primary/90 backdrop-blur border-b border-black/5">
      <div className="flex items-center gap-2 px-3 md:px-6 py-2.5">
        <Link href={home} className="shrink-0" aria-label="Home">
          <BrandLogo size={34} />
        </Link>
        <div className="flex-1 min-w-0 flex justify-center">
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

function BottomTabs({ isB2B }: { isB2B: boolean }) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-black/10 shadow-sticky pb-safe">
      <ViewOrderBar />
      <nav className="mx-auto max-w-3xl grid grid-cols-4 text-[11px]">
        {isB2B ? (
          <Tab href="/guide" label="Guide" icon={<GuideIcon />} />
        ) : (
          <Tab href="/catalog" label="Shop" icon={<CatalogIcon />} />
        )}
        <Tab href="/catalog" label="Catalog" icon={<CatalogIcon />} />
        <Tab href="/orders" label="Orders" icon={<OrdersIcon />} />
        <Tab href="/chat" label="Chat" icon={<ChatIcon />} />
      </nav>
    </div>
  );
}

function Tab({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-0.5 pt-2 pb-2 text-ink-secondary hover:text-brand-blue active:bg-bg-secondary transition"
    >
      <span className="h-5 w-5">{icon}</span>
      <span className="leading-none">{label}</span>
    </Link>
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
