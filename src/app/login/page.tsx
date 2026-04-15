import { Suspense } from "react";
import { LoginClient } from "./LoginClient";

export const metadata = { title: "Sign in — Fingerlakes Farms" };
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-8 bg-bg-secondary">
      <div className="w-full max-w-md card p-6">
        <h1 className="text-2xl mb-1">Sign in</h1>
        <p className="text-sm text-ink-secondary mb-6">
          Buyers sign in with their phone. Admins use email.
        </p>
        <Suspense fallback={null}>
          <LoginClient />
        </Suspense>
      </div>
    </main>
  );
}
