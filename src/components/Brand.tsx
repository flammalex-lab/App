import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";

/**
 * Circular brand mark using the actual FLF logo.
 * The PNG lives at /public/images/flf-logo.png.
 */
export function BrandLogo({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
      aria-label="Fingerlakes Farms"
    >
      <Image
        src="/images/flf-logo.png"
        alt="Fingerlakes Farms"
        width={size}
        height={size}
        priority
        className="rounded-full"
      />
    </span>
  );
}

/**
 * Text wordmark — used alongside the logo on desktop, hidden on mobile
 * where the circular logo is enough.
 */
export function BrandWordmark({
  size = "md",
  href = "/",
  className,
}: {
  size?: "sm" | "md" | "lg";
  href?: string | null;
  className?: string;
}) {
  const sizeClass = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl",
  }[size];

  const inner = (
    <span
      className={cn(
        "display tracking-tight text-brand-blue leading-none",
        sizeClass,
        className,
      )}
    >
      Fingerlakes Farms
    </span>
  );
  if (!href) return inner;
  return <Link href={href}>{inner}</Link>;
}
