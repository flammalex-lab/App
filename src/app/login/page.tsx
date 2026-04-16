import { Suspense } from "react";
import { LoginClient } from "./LoginClient";
import { BrandLogo } from "@/components/Brand";

export const metadata = { title: "Sign in — Fingerlakes Farms" };
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-8 bg-bg-secondary">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <BrandLogo size={64} className="mb-3" />
          <h1 className="display text-2xl tracking-tight text-center">Fingerlakes Farms</h1>
          <p className="text-sm text-ink-secondary text-center mt-1">
            Your local connection to great-tasting, healthy food.
          </p>
        </div>
        <div className="card p-6">
          <Suspense fallback={null}>
            <LoginClient />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
