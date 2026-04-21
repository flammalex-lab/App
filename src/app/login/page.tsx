import { Suspense } from "react";
import Image from "next/image";
import { LoginClient } from "./LoginClient";
import { BrandLogo } from "@/components/Brand";

export const metadata = { title: "Sign in — Fingerlakes Farms" };
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="relative min-h-screen flex items-center justify-center px-4 py-10 overflow-hidden">
      <Image
        src="/images/IMG_7794-scaled-3.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center -z-20"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-b from-black/55 via-black/35 to-black/70"
      />
      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <BrandLogo size={64} className="mb-3 drop-shadow-md" />
          <h1 className="display text-2xl tracking-tight text-center text-white drop-shadow-md">
            Fingerlakes Farms
          </h1>
          <p className="text-sm text-white/85 text-center mt-1 drop-shadow">
            Your local connection to great-tasting, healthy food.
          </p>
        </div>
        <div className="card p-6 bg-white/95 backdrop-blur-sm shadow-xl">
          <Suspense fallback={null}>
            <LoginClient />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
