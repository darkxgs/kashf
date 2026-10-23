import Link from "next/link";
import type { Lang } from "@/lib/types";
import { dict, otherLang } from "@/lib/i18n";
import { Logo } from "./brand";
import { LangSwitch } from "./lang-switch";

export function SiteHeader({ lang, altHref }: { lang: Lang; altHref: string }) {
  const t = dict(lang);
  return (
    <header className="no-print mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
      <Link href={`/${lang}`} aria-label={t.brand}>
        <Logo lang={lang} />
      </Link>
      <nav className="flex items-center gap-1">
        <Link href={`/${lang}#check`} className="hidden rounded-control px-3 py-1.5 text-[14px] text-ink-2 hover:bg-rule-2 hover:text-ink sm:block">
          {t.nav.check}
        </Link>
        <LangSwitch to={otherLang(lang)} href={altHref} label={t.nav.language} />
      </nav>
    </header>
  );
}

export function SiteFooter({ lang }: { lang: Lang }) {
  const t = dict(lang);
  return (
    <footer className="no-print mx-auto mt-24 max-w-6xl border-t border-rule px-5 py-8 text-[13.5px] text-muted sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p>
          {t.footer.by}{" "}
          <a href="https://www.seifashraf.dev" className="text-ink underline underline-offset-4">
            {lang === "ar" ? "سيف أشرف" : "Seif Ashraf"}
          </a>
        </p>
        <a href="https://github.com/darkxgs/kashf" className="hover:text-ink">
          {t.footer.source}
        </a>
      </div>
      <p className="mt-3 max-w-2xl leading-relaxed">{t.footer.privacy}</p>
    </footer>
  );
}
