import Link from "next/link";
import { ImpersonationBar } from "./ImpersonationBar";

const LINKS: { href: string; label: string }[] = [
  { href: "/dashboard",      label: "Dashboard" },
  { href: "/admin/orders",   label: "Orders" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/accounts", label: "Accounts" },
  { href: "/admin/pricing",  label: "Pricing" },
  { href: "/admin/standing", label: "Standing orders" },
  { href: "/admin/messages", label: "Messages" },
  { href: "/admin/availability", label: "Weekly availability" },
  { href: "/admin/qb",       label: "QuickBooks" },
  { href: "/admin/import",   label: "Import customers" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav() {
  return (
    <aside className="hidden lg:flex lg:flex-col w-60 border-r border-black/5 bg-white min-h-screen p-4 gap-1">
      <Link href="/dashboard" className="font-serif text-xl mb-4 px-2">FLF · Admin</Link>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="px-3 py-2 rounded hover:bg-bg-secondary text-sm">
          {l.label}
        </Link>
      ))}
      <form action="/auth/signout" method="post" className="mt-auto pt-4 border-t border-black/5">
        <button className="btn-ghost w-full text-sm">Sign out</button>
      </form>
    </aside>
  );
}

export function AdminTopBar() {
  return (
    <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-black/5 bg-white">
      <Link href="/dashboard" className="font-serif text-lg">FLF · Admin</Link>
      <details className="relative">
        <summary className="list-none btn-secondary text-sm cursor-pointer">Menu</summary>
        <div className="absolute right-0 top-full mt-1 card w-56 p-2 z-20">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="block px-3 py-2 rounded hover:bg-bg-secondary text-sm">
              {l.label}
            </Link>
          ))}
          <form action="/auth/signout" method="post" className="pt-2 mt-2 border-t border-black/5">
            <button className="btn-ghost w-full text-sm">Sign out</button>
          </form>
        </div>
      </details>
    </div>
  );
}

export { ImpersonationBar };
