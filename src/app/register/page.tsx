import { RegisterClient } from "./RegisterClient";

export const metadata = { title: "Create account — Fingerlakes Farms" };

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-8 bg-bg-secondary">
      <div className="w-full max-w-md card p-6">
        <h1 className="text-2xl mb-1">Create a retail account</h1>
        <p className="text-sm text-ink-secondary mb-6">
          For direct purchases from Grasslands, Meadow Creek, and Fingerlakes Farms.
          Wholesale buyers — your rep will set you up.
        </p>
        <RegisterClient />
      </div>
    </main>
  );
}
