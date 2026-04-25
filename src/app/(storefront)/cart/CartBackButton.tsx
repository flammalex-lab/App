"use client";

import { useRouter } from "next/navigation";

/**
 * Back button used at the top of the cart page. Prefers router.back()
 * so the user lands wherever they came from (catalog, guide, product
 * detail, etc.). Falls back to the role-appropriate home if there's
 * no history (deep-link / refresh scenario).
 */
export function CartBackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();

  function go() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      onClick={go}
      aria-label="Back"
      className="inline-flex items-center gap-1 text-[13px] text-ink-secondary hover:text-ink-primary transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 rounded-md py-1 -ml-1 px-1"
    >
      <span aria-hidden className="text-base leading-none">←</span>
      <span>Back</span>
    </button>
  );
}
