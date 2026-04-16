import Link from "next/link";
import { CartIconWithBadge } from "./CartIconWithBadge";
import { BrandLogo, BrandWordmark } from "@/components/Brand";

interface StoreNavProps {
  role: "b2b_buyer" | "dtc_customer";
}

/**
 * Top header (logo + actions) — shared mobile + desktop.
 * Bottom tab bar — mobile only (4 destinations).
 * Desktop sidebar — wider screens get a left rail.
 */
export function StoreNav({ role }: StoreNavProps) {
  const isB2B = role === "b2b_buyer";
  const home = isB2B ? "/guide" : "/catalog";
  return (
    <>
      <TopHeader home={home} />
      <BottomTabs isB2B={isB2B} />
    </>
  );
}

function TopHeader({ home }: { home: string }) {
  return (
    <header className="sticky top-0 z-30 bg-bg-primary/90 backdrop-blur border-b border-black/5">
      <div className="flex items-center justify-between px-4 md:px-6 py-3">
        <Link href={home} className="flex items-center gap-2 group">
          <BrandLogo size={36} />
          <BrandWordmark size="md" href={null} className="hidden sm:inline" />
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/catalog"
            aria-label="Search catalog"
            className="h-10 w-10 inline-flex items-center justify-center rounded-full hover:bg-bg-secondary transition"
          >
            <SearchIcon />
          </Link>
          <CartIconWithBadge />
        </div>
      </div>
    </header>
  );
}

function BottomTabs({ isB2B }: { isB2B: boolean }) {
  return (
    <>
      {/* Tab bar — visible on all screen sizes. On desktop it sits inside the
          max-width column so it doesn't feel like a phone bar on a wide monitor. */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-black/10 shadow-sticky pb-safe">
        <div className="mx-auto max-w-3xl grid grid-cols-4 text-[11px]">
          {isB2B ? (
            <Tab href="/guide" label="Guide" icon={<GuideIcon />} />
          ) : (
            <Tab href="/catalog" label="Shop" icon={<CatalogIcon />} />
          )}
          <Tab href="/catalog" label="Catalog" icon={<CatalogIcon />} />
          <Tab href="/activity" label="Activity" icon={<ActivityIcon />} />
          <Tab href="/account" label="Account" icon={<AccountIcon />} />
        </div>
      </nav>
      {/* Spacer so content doesn't sit under the tab bar */}
      <div className="h-[68px]" />
    </>
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

/* — Icons (inline SVG, 24x24) — */
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
function ActivityIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.4 8.4 0 0 1-1 4 8.5 8.5 0 0 1-7.6 4.5 8.4 8.4 0 0 1-4-1L3 21l2-5.6A8.5 8.5 0 1 1 21 11.5Z" />
    </svg>
  );
}
function AccountIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
