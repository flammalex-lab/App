import Link from "next/link";
import type { Profile } from "@/lib/supabase/types";

function initials(profile: Profile): string {
  const first = (profile.first_name ?? "").trim();
  const last = (profile.last_name ?? "").trim();
  if (first || last) return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase() || "?";
  return (profile.email ?? profile.phone ?? "?").slice(0, 1).toUpperCase();
}

/**
 * FLF-styled initials avatar (rust fill, serif display letter) — opens
 * the profile sheet at /profile.
 */
export function ProfileAvatar({ profile }: { profile: Profile }) {
  return (
    <Link
      href="/account"
      aria-label="Profile and settings"
      className="h-10 w-10 inline-flex items-center justify-center rounded-full bg-accent-rust text-white display text-sm hover:opacity-90 transition"
    >
      {initials(profile)}
    </Link>
  );
}
