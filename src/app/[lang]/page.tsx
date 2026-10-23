import Link from "next/link";
import { notFound } from "next/navigation";
import { after, connection } from "next/server";
import { Suspense } from "react";
import { getConnection } from "@/db";
import { SiteFooter, SiteHeader } from "@/components/site";
import { UrlForm } from "@/components/url-form";
import { buttonClass, cn, STATUS_STYLE } from "@/components/ui";
import { CATEGORIES, CHECKS, prescription } from "@/lib/checks";
import { titleOf } from "@/lib/copy";
import { dateOnly } from "@/lib/format";
import { allowPrivateTargets, appUrl } from "@/lib/app-url";
import { CHECK_LABELS, dict, isLang } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import { displayHost } from "@/lib/url";
import { createAudit, latestDemoAudit, olderThan, runAudit } from "@/server/audits";
import { claim } from "@/server/jobs";
import { checkUrl } from "./actions";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang: l } = await params;
  if (!isLang(l)) notFound();
  const lang = l as Lang;
  const t = dict(lang);
  return (
    <>
      <SiteHeader lang={lang} altHref={`/${lang === "ar" ? "en" : "ar"}`} />
      <main>
        <section id="check" className="mx-auto grid max-w-6xl scroll-mt-8 grid-cols-[minmax(0,1fr)] gap-12 px-5 pt-8 pb-4 sm:px-8 sm:pt-14 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:items-center lg:gap-16">
          <div>
            <h1 className="max-w-2xl text-[40px] leading-[1.08] font-semibold tracking-[-0.03em] text-balance sm:text-[56px]">{t.hero.title}</h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-2">{t.hero.sub}</p>
            <div className="mt-8">
              <Suspense fallback={<div className="h-[66px] max-w-xl rounded-[14px] border border-rule bg-paper" />}>
                <UrlForm lang={lang} labels={{ placeholder: t.hero.placeholder, cta: t.hero.cta, invalid: t.form.invalid, private: t.form.private, limited: t.form.limited }} />
              </Suspense>
            </div>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted">{t.hero.note}</p>
            <form action={checkUrl} className="mt-5">
              <input type="hidden" name="url" value={`${appUrl()}/demo-store`} />
              <input type="hidden" name="lang" value={lang} />
              <button type="submit" className="text-[15px] font-medium text-pen underline decoration-pen/30 underline-offset-[5px] hover:decoration-pen">
                {t.hero.demo}
              </button>
            </form>
          </div>
          <Suspense fallback={<div className="h-[420px] animate-pulse rounded-sheet bg-rule-2" />}>
            <SampleSlip lang={lang} />
          </Suspense>
        </section>

        <section className="mx-auto mt-28 max-w-6xl px-5 sm:px-8">
          <h2 className="max-w-2xl text-[30px] leading-tight font-semibold tracking-[-0.02em] sm:text-[36px]">{t.covers.title}</h2>
          <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-ink-2">{t.covers.sub}</p>
          <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-5">
            {CATEGORIES.map((c) => (
              <div key={c} className="border-t-2 border-ink pt-4">
                <h3 className="text-[17px] font-semibold">{t.categories[c]}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{t.categoryBlurb[c]}</p>
                <ul className="mt-4 grid gap-1.5 text-[14px] text-ink-2">
                  {CHECKS.filter((x) => x.category === c && CHECK_LABELS[x.id]).map((x) => (
                    <li key={x.id}>{CHECK_LABELS[x.id][lang]}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-28 max-w-6xl px-5 sm:px-8">
          <div className="grid gap-10 rounded-sheet bg-paper px-6 py-10 sm:px-12 sm:py-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
            <h2 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[34px]">{t.region.title}</h2>
            <ul className="grid gap-4">
              {t.region.points.map((p) => (
                <li key={p} className="flex gap-3 text-[16px] leading-relaxed text-ink-2">
                  <span className="mt-[11px] h-0.5 w-4 shrink-0 rounded-full bg-pen" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-6xl px-5 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-6 border-y border-rule py-8">
            <div className="max-w-xl">
              <h2 className="text-[20px] font-semibold">{t.help.title}</h2>
              <p className="mt-1 text-[15.5px] leading-relaxed text-ink-2">{t.help.body}</p>
            </div>
            <a href="https://www.seifashraf.dev/contact" className={buttonClass("ink", "md")}>
              {t.help.cta}
            </a>
          </div>
        </section>
      </main>
      <SiteFooter lang={lang} />
    </>
  );
}

/**
 * A real report of the demo store, shown as a slip. The demo is re-checked
 * at most every six hours, in the background, so the sample stays current.
 */
async function SampleSlip({ lang }: { lang: Lang }) {
  await connection();
  const t = dict(lang);
  const conn = await getConnection();
  const demo = await latestDemoAudit(conn);
  if (!demo || olderThan(demo.createdAt, 6 * 3_600_000)) {
    after(async () => {
      if (!(await claim(conn, "demo-audit", 6 * 3600))) return;
      const r = await createAudit(conn, { url: `${appUrl()}/demo-store`, ipHash: null, isDemo: true, fresh: true });
      if (r.ok) await runAudit(conn, r.id, { allowPrivate: allowPrivateTargets(), psi: false });
    });
  }
  if (!demo) {
    return <div className="rounded-sheet border border-dashed border-rule px-8 py-16 text-center text-[15px] text-muted">{t.sample.preparing}</div>;
  }
  const findings = demo.findings ?? [];
  const rx = prescription(findings, 3);
  const score = demo.score ?? 0;
  const tone = score >= 70 ? "pass" : score >= 50 ? "warn" : "fail";
  return (
    <figure className="relative">
      <figcaption className="mb-3 text-[14px] font-medium text-muted">{t.sample.title}</figcaption>
      <div className="overflow-hidden rounded-sheet border border-rule bg-paper shadow-[0_1px_0_rgb(20_27_45/0.04),0_30px_60px_-30px_rgb(20_27_45/0.25)]">
        <div className="flex items-start justify-between gap-6 border-b border-rule px-6 py-5">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-pen">{t.report.kicker}</p>
            <p className="mt-0.5 truncate text-[19px] font-semibold">
              <bdi dir="ltr">{displayHost(demo.finalUrl ?? demo.url)}</bdi>
            </p>
            <p className="mt-0.5 text-[13px] text-muted">{dateOnly(demo.createdAt, lang)}</p>
          </div>
          <p className={cn("text-[56px] leading-[0.85] font-semibold tracking-[-0.04em] tnum", STATUS_STYLE[tone].text)}>{score}</p>
        </div>
        <div className="grid grid-cols-5 gap-px bg-rule-2">
          {CATEGORIES.map((c) => {
            const v = demo.scores?.[c] ?? 0;
            const s = v >= 70 ? "pass" : v >= 50 ? "warn" : "fail";
            return (
              <div key={c} className="bg-paper px-3 py-3">
                <p className="truncate text-[11.5px] text-muted">{t.categories[c]}</p>
                <p className={cn("text-[18px] font-semibold tnum", STATUS_STYLE[s].text)}>{v}</p>
              </div>
            );
          })}
        </div>
        <div className="px-6 pt-5 pb-6">
          <p className="text-[15px] font-semibold text-pen-deep">{t.report.rx}</p>
          <ol className="mt-2">
            {rx.map((f, i) => (
              <li key={f.id} className="flex gap-3 border-b border-dashed border-rule py-2.5 text-[14.5px] leading-snug last:border-b-0">
                <span className="w-4 shrink-0 font-semibold text-pen tnum">{i + 1}</span>
                <span>{titleOf(f, lang)}</span>
              </li>
            ))}
          </ol>
          <Link href={`/${lang}/r/${demo.id}`} className={buttonClass("outline", "sm", "mt-4")}>
            {t.sample.open}
          </Link>
        </div>
      </div>
    </figure>
  );
}
