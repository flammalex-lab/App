"use client";

import { useEffect, useState } from "react";

// Chromium's BeforeInstallPromptEvent isn't in the standard lib.d.ts yet.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "flf:install-prompt-dismissed";

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports as Mac; touch points disambiguate.
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(ua) || iPadOS;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS-specific legacy flag
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function InstallPrompt() {
  const [mode, setMode] = useState<"hidden" | "ios" | "android">("hidden");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // Private mode / disabled storage — just proceed without persistence.
    }

    let cancelled = false;
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("android");
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    let iosTimer: number | undefined;
    (async () => {
      // Suppress the install banner inside the Capacitor wrapper —
      // the user is already running the installed native app.
      const { Capacitor } = await import("@capacitor/core");
      if (cancelled || Capacitor.isNativePlatform()) return;
      if (isIos()) {
        iosTimer = window.setTimeout(() => {
          if (!cancelled) setMode("ios");
        }, 1200);
      }
    })();

    return () => {
      cancelled = true;
      if (iosTimer !== undefined) window.clearTimeout(iosTimer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setMode("hidden");
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setMode("hidden");
      } else {
        dismiss();
      }
    } catch {
      dismiss();
    } finally {
      setDeferred(null);
    }
  };

  if (mode === "hidden") return null;

  return (
    <div
      role="region"
      aria-label="Install Fingerlakes Farms"
      className="fixed inset-x-0 z-50 px-4 animate-slide-up"
      style={{
        // Sit above the iOS home indicator / Android nav bar.
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
      }}
    >
      <div className="mx-auto max-w-md rounded-2xl border border-ink-primary/10 bg-bg-primary shadow-floating p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="font-display text-lg font-bold tracking-tight text-ink-primary">
              Keep the farm on your Home Screen
            </p>
            {mode === "ios" ? (
              <p className="mt-1 text-sm text-ink-secondary">
                Tap the{" "}
                <span className="font-semibold text-brand-blue">Share</span> icon,
                then <span className="font-semibold text-brand-blue">Add to Home Screen</span>.
                One tap from there to today&rsquo;s order guide.
              </p>
            ) : (
              <p className="mt-1 text-sm text-ink-secondary">
                Install the app for a faster route to today&rsquo;s order guide — no app store required.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="-mr-1 -mt-1 shrink-0 rounded-full p-2 text-ink-tertiary hover:bg-bg-secondary hover:text-ink-primary transition-colors duration-150"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        {mode === "android" ? (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={install}
              className="flex-1 rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-blue-dark transition-colors duration-150"
            >
              Install app
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-lg px-4 py-2.5 text-sm font-semibold text-accent-rust hover:bg-bg-secondary transition-colors duration-150"
            >
              Not now
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
