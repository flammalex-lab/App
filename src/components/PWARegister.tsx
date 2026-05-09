"use client";

import { useEffect } from "react";

export function PWARegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // After a /auth/signout?signedout=1 redirect, force-clear the SW + every
    // cache so the next session can't serve the prior buyer's shell out of
    // the offline cache. The flag is a one-shot — strip it from the URL
    // after we handle it so a refresh doesn't keep clearing forever.
    if (typeof window !== "undefined" && window.location.search.includes("signedout=1")) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
      if ("caches" in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      }
      const url = new URL(window.location.href);
      url.searchParams.delete("signedout");
      window.history.replaceState({}, "", url.toString());
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      // In dev, actively unregister any prior SW + clear its caches so HMR
      // and auth-cookie navigations aren't served from a stale shell.
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
      if ("caches" in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      }
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
