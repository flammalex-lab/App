import Link from "next/link";
import { BrandLogo } from "@/components/Brand";

export const metadata = { title: "Not found — Fingerlakes Farms" };

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col bg-bg-secondary">
      <header className="bg-white/80 backdrop-blur-md border-b border-black/[0.06] supports-[backdrop-filter]:bg-white/70">
        <div className="flex items-center px-3 md:px-6 py-1.5">
          <Link href="/" aria-label="Home" className="shrink-0">
            <BrandLogo size={28} />
          </Link>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="card p-8 max-w-md text-center">
          <h1 className="text-3xl mb-2">Not found</h1>
          <p className="text-ink-secondary mb-6">
            That page doesn&apos;t exist — or you don&apos;t have access.
          </p>
          <div className="flex flex-col gap-2">
            <Link href="/" className="btn-primary">Go home</Link>
            <a href="mailto:orders@ilovenyfarms.com" className="text-sm text-brand-blue hover:underline">
              Email any questions to orders@ilovenyfarms.com
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
