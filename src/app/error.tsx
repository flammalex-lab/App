"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-8 bg-bg-secondary">
      <div className="card p-8 max-w-md text-center">
        <h1 className="text-3xl mb-2">Something went wrong</h1>
        <p className="text-ink-secondary mb-4">{error.message}</p>
        <div className="flex gap-2 justify-center">
          <button onClick={reset} className="btn-primary">Try again</button>
          <Link href="/" className="btn-ghost">Go home</Link>
        </div>
      </div>
    </main>
  );
}
