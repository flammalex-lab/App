import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-8 bg-bg-secondary">
      <div className="card p-8 max-w-md text-center">
        <h1 className="text-3xl mb-2">Not found</h1>
        <p className="text-ink-secondary mb-6">
          That page doesn&apos;t exist — or you don&apos;t have access.
        </p>
        <Link href="/" className="btn-primary">Go home</Link>
      </div>
    </main>
  );
}
