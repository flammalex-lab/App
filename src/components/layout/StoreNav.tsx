import Link from "next/link";
import { CartBadge } from "./CartBadge";

export function StoreNav({ role }: { role: "b2b_buyer" | "dtc_customer" }) {
  const isB2B = role === "b2b_buyer";
  return (
    <>
      <nav className="hidden md:flex items-center justify-between px-6 py-4 border-b border-black/5 bg-white/80 backdrop-blur sticky top-0 z-20">
        <Link href={isB2B ? "/guide" : "/catalog"} className="font-serif text-xl">
          Fingerlakes Farms
        </Link>
        <div className="flex items-center gap-1 text-sm">
          {isB2B ? <NavLink href="/guide">Order guide</NavLink> : null}
          <NavLink href="/catalog">Catalog</NavLink>
          <NavLink href="/orders">Orders</NavLink>
          {isB2B ? <NavLink href="/standing">Standing</NavLink> : null}
          {isB2B ? <NavLink href="/messages">Messages</NavLink> : null}
          <NavLink href="/account">Account</NavLink>
          <Link href="/cart" className="ml-2 btn-primary px-3 py-1.5 text-sm">
            Cart <CartBadge />
          </Link>
          <form action="/auth/signout" method="post">
            <button className="ml-1 btn-ghost px-2 py-1 text-sm">Sign out</button>
          </form>
        </div>
      </nav>
      <MobileNav isB2B={isB2B} />
    </>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="px-3 py-1.5 rounded hover:bg-bg-secondary transition">
      {children}
    </Link>
  );
}

function MobileNav({ isB2B }: { isB2B: boolean }) {
  return (
    <>
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-black/5 bg-white/90 sticky top-0 z-20">
        <Link href={isB2B ? "/guide" : "/catalog"} className="font-serif text-lg">
          Fingerlakes Farms
        </Link>
        <Link href="/cart" className="btn-primary px-3 py-1.5 text-sm">
          Cart <CartBadge />
        </Link>
      </div>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 grid grid-cols-5 border-t border-black/10 bg-white text-xs">
        {isB2B ? <Tab href="/guide" label="Guide" icon="★" /> : <Tab href="/catalog" label="Shop" icon="✦" />}
        <Tab href="/catalog" label="Catalog" icon="≡" />
        <Tab href="/orders" label="Orders" icon="◱" />
        {isB2B ? <Tab href="/messages" label="Chat" icon="◎" /> : <Tab href="/orders" label="Track" icon="◎" />}
        <Tab href="/account" label="Account" icon="◉" />
      </nav>
      <div className="md:hidden h-16" />
    </>
  );
}

function Tab({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link href={href} className="flex flex-col items-center justify-center py-2 active:bg-bg-secondary">
      <span className="text-base">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
