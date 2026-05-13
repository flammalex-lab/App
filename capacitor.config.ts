import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor wraps the live Vercel deployment in a native iOS/Android
 * shell. We don't static-export the app — `server.url` points the
 * WebView at the production deployment (or whatever `NEXT_PUBLIC_APP_URL`
 * is at build time). `webDir` still has to point somewhere on disk for
 * Capacitor's sync step, hence `public/`.
 *
 * `appId` and the fallback URL below are placeholders — Alex should
 * confirm both before the first App Store / Play submission.
 */
const config: CapacitorConfig = {
  appId: "com.fingerlakesfarms.portal",
  appName: "Fingerlakes Farms",
  webDir: "public",
  server: {
    url: process.env.NEXT_PUBLIC_APP_URL ?? "https://flf-portal.vercel.app",
    androidScheme: "https",
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#FBFAF6",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#1763B5",
    },
  },
};

export default config;
