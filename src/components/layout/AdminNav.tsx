"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { QuickAddBuyerDialog } from "@/components/QuickAddBuyerDialog";

type NavLink = { href: string; label: string };

const SECTIONS: { title?: string; links: NavLink[] }[] = [
  {
    links: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/admin/orders", label: "Orders" },
      { href: "/admin/products", label: "Products" },
      { href: "/admin/accounts", label: "Accounts" },
    ],
  },
  {
    title: "Workflow",
    links: [
      { href: "/admin/order-guides", label: "Order guides" },
      { href: "/admin/order-guides/templates", label: "Guide templates" },
      { href: "/admin/pricing", label: "Pricing" },
      { href: "/admin/standing", label: "Standing orders" },
      { href: "/admin/messages", label: "Messages" },
      { href: "/admin/availability", label: "Weekly availability" },
    ],
  },
  {
    title: "Tools",
    links: [
      { href: "/admin/qb", label: "QuickBooks" },
      { href: "/admin/import", label: "Import customers" },
      { href: "/admin/items-import", label: "Import items (QB)" },
      { href: "/admin/image-triage", label: "Image triage" },
      { href: "/admin/settings", label: "Settings" },
    ],
  },
];

const FLAT_LINKS: NavLink[] = SECTIONS.flatMap((s) => s.links);

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

export function AdminNav() {
  const pathname = usePathname();
  const [addOpen, setAddOpen] = useState(false);
  return (
    <>
      <aside className="hidden lg:flex lg:flex-col w-60 border-r border-black/5 bg-white min-h-screen p-4">
        <Link href="/dashboard" className="display text-xl mb-5 px-2 tracking-tight">
          FLF <span className="text-brand-blue">·</span> Admin
        </Link>
        <button
          onClick={() => setAddOpen(true)}
          className="btn-primary text-sm w-full mb-5 flex items-center justify-center gap-2"
        >
          <span aria-hidden>+</span> Add buyer
        </button>
        <nav className="flex flex-col gap-5 flex-1">
          {SECTIONS.map((section, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              {section.title ? (
                <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary">
                  {section.title}
                </div>
              ) : null}
              {section.links.map((l) => (
                <NavItem key={l.href} href={l.href} label={l.label} active={isActive(pathname, l.href)} />
              ))}
            </div>
          ))}
        </nav>
        <form action="/auth/signout" method="post" className="pt-4 border-t border-black/5">
          <button className="btn-ghost w-full text-sm">Sign out</button>
        </form>
      </aside>
      <QuickAddBuyerDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}

export function AdminTopBar() {
  const pathname = usePathname();
  const [addOpen, setAddOpen] = useState(false);
  return (
    <>
      <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-black/5 bg-white gap-2">
        <Link href="/dashboard" className="display text-lg tracking-tight">
          FLF <span className="text-brand-blue">·</span> Admin
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAddOpen(true)}
            className="btn-primary text-sm inline-flex items-center gap-1"
          >
            <span aria-hidden>+</span> Add buyer
          </button>
          <details className="relative">
            <summary className="list-none btn-secondary text-sm cursor-pointer">Menu</summary>
            <div className="absolute right-0 top-full mt-1 card w-60 p-2 z-20 flex flex-col gap-0.5">
              {FLAT_LINKS.map((l) => (
                <NavItem key={l.href} href={l.href} label={l.label} active={isActive(pathname, l.href)} />
              ))}
              <form action="/auth/signout" method="post" className="pt-2 mt-2 border-t border-black/5">
                <button className="btn-ghost w-full text-sm">Sign out</button>
              </form>
            </div>
          </details>
        </div>
      </div>
      <QuickAddBuyerDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}

function NavItem({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative px-3 py-2 rounded-md text-sm transition",
        active
          ? "bg-brand-blue-tint text-brand-blue font-semibold"
          : "text-ink-primary hover:bg-bg-secondary",
      )}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-brand-blue"
        />
      ) : null}
      {label}
    </Link>
  );
}
