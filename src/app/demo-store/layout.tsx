import type { Metadata } from "next";
import Link from "next/link";
import "@fontsource-variable/readex-pro/index.css";
import "../globals.css";

// Deliberately incomplete: no description, no share image, no canonical.
export const metadata: Metadata = {
  title: "نسيم | عطور ودهن عود (متجر تجريبي)",
  openGraph: { title: "نسيم للعطور" },
};

export default function DemoStoreLayout({ children }: LayoutProps<"/demo-store">) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        {/* Four old scripts that hold up the first paint, as many real stores have. */}
        <script src="/demo-store/js/jquery-lite.js" />
        <script src="/demo-store/js/legacy-slider.js" />
        <script src="/demo-store/js/cart-badge.js" />
        <script src="/demo-store/js/popup-offer.js" />
      </head>
      <body className="min-h-dvh bg-[#faf7f2] text-[#2b2118]">
        <p className="bg-[#2b2118] px-4 py-2 text-center text-[13px] text-[#f3e9dc]">
          هذا متجر تجريبي صنعناه لاختبار أداة «كشف»، ولا يبيع شيئًا. <span lang="en" dir="ltr">A demo store for testing Kashf. Nothing here is for sale.</span>{" "}
          <Link href="/ar" className="underline underline-offset-4">
            العودة إلى كشف
          </Link>
        </p>
        <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Link href="/demo-store" className="text-[26px] font-semibold tracking-tight">
            نسيم
          </Link>
          <nav className="hidden gap-7 text-[15px] sm:flex">
            <Link href="/demo-store">الرئيسية</Link>
            <Link href="/demo-store/products/amber-crystal">العطور</Link>
            <Link href="/demo-store/products/white-mabkhara">البخور</Link>
            <Link href="/demo-store/products/gift-set">الهدايا</Link>
          </nav>
          <a href="tel:+966500000000" className="text-[14px]" dir="ltr">
            +966 50 000 0000
          </a>
        </header>
        {children}
        <footer className="mt-20 border-t border-[#e7dccd] bg-[#f3ece2]">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 text-[14px] sm:grid-cols-3">
            <div>
              <p className="text-[18px] font-semibold">نسيم</p>
              <p className="mt-2 leading-relaxed text-[#6b5a48]">عطور عربية ودهن عود وبخور، مختارة بعناية.</p>
            </div>
            <ul className="grid gap-2">
              <li>
                <Link href="/demo-store/pages/shipping">الشحن والتوصيل</Link>
              </li>
              <li>
                <Link href="/demo-store/pages/privacy">سياسة الخصوصية</Link>
              </li>
              <li>
                <Link href="/demo-store/offers/eid-2025">عروض العيد</Link>
              </li>
              <li>
                <a href="https://www.instagram.com/" rel="nofollow">
                  إنستغرام
                </a>
              </li>
            </ul>
            <div>
              <p className="text-[#6b5a48]">نقبل الدفع عبر</p>
              <p className="mt-2 flex flex-wrap gap-2">
                {["mada", "Apple Pay", "Tabby"].map((p) => (
                  <span key={p} className="rounded border border-[#e0d3c1] bg-white px-2 py-0.5 text-[12px]" lang="en">
                    {p}
                  </span>
                ))}
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
