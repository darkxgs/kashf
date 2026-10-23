import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "@fontsource-variable/readex-pro/index.css";
import "../globals.css";
import { appUrl } from "@/lib/app-url";
import { dict, isLang } from "@/lib/i18n";

export async function generateStaticParams() {
  return [{ lang: "ar" }, { lang: "en" }];
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = dict(lang);
  return {
    metadataBase: new URL(appUrl()),
    title: { default: t.meta.title, template: `%s | ${t.brand}` },
    description: t.meta.description,
    alternates: { languages: { ar: "/ar", en: "/en" } },
    openGraph: { title: t.meta.title, description: t.meta.description, type: "website", locale: lang === "ar" ? "ar_SA" : "en_US" },
  };
}

export const viewport: Viewport = { themeColor: "#eef1f6" };

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"}>
      <body className="min-h-dvh bg-desk text-ink">{children}</body>
    </html>
  );
}
