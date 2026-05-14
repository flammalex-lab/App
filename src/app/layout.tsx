import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import "./globals.css";
import { CapacitorBoot } from "@/components/CapacitorBoot";
import { InstallPrompt } from "@/components/InstallPrompt";
import { PWARegister } from "@/components/PWARegister";
import { ToastProvider } from "@/components/ui/Toast";

// Self-hosted via next/font: removes the FOUT flash you get with the
// Google CDN <link>, and avoids a third-party request on every page.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fingerlakes Farms",
  description: "Order fresh NYS farm products — wholesale and direct.",
  manifest: "/manifest.json",
  icons: {
    // Per-size derivatives generated from the 1024px master via
    // scripts/resize-logo.py — saves ~660KB on every cold page load
    // because browsers were previously eating the full master for a 32px slot.
    icon: [
      { url: "/icons/icon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    // Apple touch icons for iOS Home Screen installs. The 180x180 is the
    // primary modern size; the smaller sizes are for older iOS versions
    // that ignore the modern size hint.
    apple: [
      { url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" },
      { url: "/icons/icon-152.png", sizes: "152x152", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Fingerlakes Farms",
  },
};

export const viewport: Viewport = {
  themeColor: "#1763B5",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${inter.variable}`}>
      <body className="min-h-screen">
        <ToastProvider>{children}</ToastProvider>
        <PWARegister />
        <CapacitorBoot />
        <InstallPrompt />
      </body>
    </html>
  );
}
