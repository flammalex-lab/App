import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import "./globals.css";
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
    icon: [
      { url: "/images/flf-logo.png", type: "image/png", sizes: "500x500" },
    ],
    apple: { url: "/images/flf-logo.png" },
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "FLF" },
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
      </body>
    </html>
  );
}
