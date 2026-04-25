"use client";

import { useRouter } from "next/navigation";

/**
 * Smart back button used on slide-in detail screens (cart, producer
 * page, etc.). Prefers router.back() so the user lands wherever they
 * came from. Falls back to the given href if there's no history
 * (deep-link or hard refresh).
 */
export function BackButton({
  fallbackHref,
  label = "Back",
}: {
  fallbackHref: string;
  label?: string;
}) {
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
      aria-label={label}
      className="inline-flex items-center gap-1 text-[13px] text-ink-secondary hover:text-ink-primary transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-blue/40 rounded-md py-1 -ml-1 px-1"
    >
      <span aria-hidden className="text-base leading-none">←</span>
      <span>{label}</span>
    </button>
  );
}
