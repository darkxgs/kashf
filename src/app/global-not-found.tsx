import type { Metadata } from "next";
import "@fontsource-variable/readex-pro/index.css";
import "./globals.css";
import Link from "next/link";
import { Logo } from "@/components/brand";

export const metadata: Metadata = { title: "Not found | Kashf" };

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-desk text-ink">
        <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6">
          <Link href="/" className="self-start">
            <Logo lang="en" />
          </Link>
          <h1 className="mt-10 text-[30px] leading-tight font-semibold">Nothing at this address</h1>
          <p className="mt-3 text-[16px] leading-relaxed text-ink-2">The link may be mistyped.</p>
          <p lang="ar" dir="rtl" className="mt-1 text-left text-[16px] text-ink-2">
            لا يوجد شيء بهذا الرابط. ربما كُتب بشكل خاطئ.
          </p>
          <Link href="/" className="mt-8 inline-flex h-11 items-center self-start rounded-control bg-pen px-5 text-[15px] font-medium text-white">
            Check a store / افحص متجرًا
          </Link>
        </main>
      </body>
    </html>
  );
}
