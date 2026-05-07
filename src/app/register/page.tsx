import { RegisterClient } from "./RegisterClient";

export const metadata = { title: "Create account — Fingerlakes Farms" };
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-8 bg-bg-secondary">
      <div className="w-full max-w-md card p-6">
        <h1 className="text-2xl mb-1">Create an account</h1>
        <p className="text-sm text-ink-secondary mb-6">
          For direct purchases from Fingerlakes Farms.
        </p>
        <RegisterClient />
      </div>
    </main>
  );
}
