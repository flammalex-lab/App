"use client";

import { useEffect } from "react";

/**
 * Mounted once near the root of the tree. On the web this is a no-op.
 * Inside the Capacitor native shell it:
 *   - styles the iOS / Android status bar to sit on brand-blue
 *   - explicitly hides the launch splash so the WebView's first paint
 *     swaps in cleanly (Capacitor's auto-hide can race RSC streaming)
 *   - re-registers for push when permission is already granted and
 *     forwards the resulting device token to /api/push/register so the
 *     fanout worker can address this device. First-time opt-in is the
 *     explicit "Enable order alerts" CTA on the account page; we never
 *     auto-prompt on cold start (annoying + tanks acceptance rates).
 */
export function CapacitorBoot() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (cancelled || !Capacitor.isNativePlatform()) return;

      const [{ StatusBar, Style }, { SplashScreen }, { PushNotifications }] =
        await Promise.all([
          import("@capacitor/status-bar"),
          import("@capacitor/splash-screen"),
          import("@capacitor/push-notifications"),
        ]);

      await StatusBar.setStyle({ style: Style.Light });
      // Android-only; iOS WKWebView paints under the status bar and
      // the color comes from the OS chrome.
      await StatusBar.setBackgroundColor({ color: "#1763B5" });
      await SplashScreen.hide();

      const perms = await PushNotifications.checkPermissions();
      if (perms.receive !== "granted") return;

      await PushNotifications.addListener("registration", (t) => {
        const platform = Capacitor.getPlatform();
        if (platform !== "ios" && platform !== "android") return;
        // Fire-and-forget — registration races with RSC navigation
        // and we don't want to block paint on this. A retry on next
        // app launch is fine if the network was offline.
        fetch("/api/push/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: t.value, platform }),
          credentials: "same-origin",
        }).catch(() => null);
      });
      await PushNotifications.register();
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
