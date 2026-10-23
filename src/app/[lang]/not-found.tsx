import Link from "next/link";
import { lang as rootLang } from "next/root-params";
import { SiteFooter, SiteHeader } from "@/components/site";
import { buttonClass } from "@/components/ui";
import { dict, isLang, otherLang } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

export default async function NotFound() {
  const l = await rootLang();
  const lang: Lang = isLang(l) ? l : "ar";
  const t = dict(lang).notFound;
  return (
    <>
      <SiteHeader lang={lang} altHref={`/${otherLang(lang)}`} />
      <main className="mx-auto max-w-2xl px-4 pt-6 sm:pt-12">
        <div className="rounded-sheet border border-rule bg-paper px-5 py-8 sm:px-9">
          <h1 className="text-[26px] leading-tight font-semibold">{t.title}</h1>
          <p className="mt-3 text-[16px] leading-relaxed text-ink-2">{t.body}</p>
          <Link href={`/${lang}#check`} className={`${buttonClass("pen", "md")} mt-7`}>
            {t.cta}
          </Link>
        </div>
      </main>
      <SiteFooter lang={lang} />
    </>
  );
}
