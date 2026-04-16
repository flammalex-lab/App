import Link from "next/link";
import { cn } from "@/lib/utils/cn";

/**
 * Wordmark version of the FLF identity. Used in the app header.
 * Drop a real logo SVG/PNG at /public/images/flf-logo.svg and update
 * BrandLogo to render <img> instead.
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
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
  }[size];

  const inner = (
    <span className={cn("display tracking-tighter text-brand-blue leading-none", sizeClass, className)}>
      Fingerlakes <span className="text-brand-green">Farms</span>
    </span>
  );
  if (!href) return inner;
  return <Link href={href}>{inner}</Link>;
}

/**
 * Compact circular brand mark. Stand-in for the actual logo until you
 * drop the real PNG/SVG at /public/images/flf-logo.svg.
 *
 * Replace this component with:
 *    <img src="/images/flf-logo.svg" alt="FLF" />
 * once the asset is in place.
 */
export function BrandLogo({ size = 32 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-brand-blue text-white font-bold display"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-label="Fingerlakes Farms"
    >
      F
    </span>
  );
}
