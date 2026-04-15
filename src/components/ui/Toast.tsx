"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Tone = "success" | "error" | "info";
interface Toast {
  id: string;
  body: string;
  tone: Tone;
}

interface Ctx {
  push: (body: string, tone?: Tone) => void;
}

const ToastContext = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  function push(body: string, tone: Tone = "info") {
    const id = crypto.randomUUID();
    setItems((prev) => [...prev, { id, body, tone }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-20 md:bottom-6 right-4 z-50 flex flex-col gap-2 items-end pointer-events-none">
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-md shadow-card px-4 py-3 text-sm max-w-xs animate-[fade-in_.15s_ease] ${
              t.tone === "success"
                ? "bg-brand-green text-white"
                : t.tone === "error"
                  ? "bg-feedback-error text-white"
                  : "bg-white border border-black/10"
            }`}
          >
            {t.body}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Ctx {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Allow usage outside provider (tests/storybook) without crashing
    return { push: (b) => console.log("[toast]", b) };
  }
  return ctx;
}
