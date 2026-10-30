import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getConnection } from "@/db";
import { AuditProgress } from "@/components/report-parts";
import { Report } from "@/components/report";
import { SiteFooter, SiteHeader } from "@/components/site";
import { buttonClass } from "@/components/ui";
import { dict, isLang } from "@/lib/i18n";
import type { Lang, StepKey } from "@/lib/types";
import { displayHost, hostAndPath } from "@/lib/url";
import { earlierAudits, expireStuck, getAudit, olderThan } from "@/server/audits";
import { checkUrl } from "../../actions";

const STEP_ORDER: StepKey[] = ["home", "security", "assets", "crawl", "product", "score"];

export async function generateMetadata({ params }: PageProps<"/[lang]/r/[id]">): Promise<Metadata> {
  await connection();
  const { lang, id } = await params;
  if (!isLang(lang)) return {};
  const a = await getAudit(await getConnection(), id);
  if (!a) return { title: dict(lang).notFound.title };
  const host = displayHost(a.finalUrl ?? a.url);
  const title = a.status === "done" ? `${host}: ${a.score}/100` : host;
  const description =
    lang === "ar"
      ? `فحص كشف لمتجر ${host}: السرعة والظهور في البحث والثقة والجوال والأمان، مع ما يجب إصلاحه أولًا.`
      : `Kashf check-up of ${host}: speed, search, trust, mobile and security, with what to fix first.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "article", locale: lang === "ar" ? "ar_SA" : "en_US" },
    robots: { index: false },
    alternates: { languages: { ar: `/ar/r/${id}`, en: `/en/r/${id}` } },
  };
}

export default function ReportPage(props: PageProps<"/[lang]/r/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-24 h-[70vh] max-w-6xl animate-pulse rounded-sheet bg-rule-2" />}>
      <ReportRoute {...props} />
    </Suspense>
  );
}

async function ReportRoute({ params }: PageProps<"/[lang]/r/[id]">) {
  await connection();
  const { lang: l, id } = await params;
  if (!isLang(l)) notFound();
  const lang = l as Lang;
  const conn = await getConnection();
  let audit = await getAudit(conn, id);
  if (!audit) notFound();
  if (audit.status === "running" && olderThan(audit.createdAt, 3 * 60_000)) {
    await expireStuck(conn);
    audit = (await getAudit(conn, id))!;
  }
  const t = dict(lang);
  const alt = `/${lang === "ar" ? "en" : "ar"}/r/${id}`;
  const host = displayHost(audit.finalUrl ?? audit.url);

  if (audit.status === "running") {
    const target = hostAndPath(audit.url);
    return (
      <>
        <SiteHeader lang={lang} altHref={alt} />
        <main className="mx-auto max-w-2xl px-4 pt-6 sm:pt-12">
          <div className="rounded-sheet border border-rule bg-paper px-5 py-7 shadow-[0_20px_50px_-24px_rgb(20_27_45/0.18)] sm:px-9 sm:py-9">
            <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.015em] break-words sm:text-[30px]">
              {lang === "ar" ? "نفحص " : "Checking "}
              <bdi dir="ltr">{target.host}</bdi>
            </h1>
            {target.path ? (
              <p className="mt-1 truncate text-[14px] text-muted">
                <bdi dir="ltr">{target.path}</bdi>
              </p>
            ) : null}
            <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{t.progress.sub}</p>
            <div className="mt-6">
              <AuditProgress
                id={audit.id}
                startedAt={audit.createdAt.toISOString()}
                initial={audit.steps}
                labels={STEP_ORDER.map((k) => ({ key: k, label: t.progress.steps[k] }))}
                lang={lang}
              />
            </div>
          </div>
        </main>
      </>
    );
  }

  if (audit.status === "failed") {
    const e = t.errors;
    const code = (audit.error ?? "network") as keyof typeof e;
    const msg = code === "http_error" ? e.http_error(audit.errorStatus ?? 500) : typeof e[code] === "string" ? (e[code] as string) : e.network;
    return (
      <>
        <SiteHeader lang={lang} altHref={alt} />
        <main className="mx-auto max-w-2xl px-4 pt-6 sm:pt-12">
          <div className="rounded-sheet border border-rule bg-paper px-5 py-8 sm:px-9">
            <p className="text-[14px] text-muted">
              <bdi dir="ltr">{host}</bdi>
            </p>
            <h1 className="mt-1 text-[26px] leading-tight font-semibold">{e.title}</h1>
            <p className="mt-3 text-[16px] leading-relaxed text-ink-2">{msg}</p>
            <div className="mt-7 flex flex-wrap gap-2">
              <form action={checkUrl}>
                <input type="hidden" name="url" value={audit.url} />
                <input type="hidden" name="lang" value={lang} />
                <input type="hidden" name="fresh" value="1" />
                <button type="submit" className={buttonClass("pen", "md")}>
                  {e.retry}
                </button>
              </form>
              <Link href={`/${lang}#check`} className={buttonClass("outline", "md")}>
                {e.other}
              </Link>
            </div>
          </div>
        </main>
        <SiteFooter lang={lang} />
      </>
    );
  }

  const earlier = await earlierAudits(conn, audit.host, audit.createdAt);
  return (
    <>
      <SiteHeader lang={lang} altHref={alt} />
      <main className="animate-rise">
        <Report audit={audit} lang={lang} earlier={earlier.map((e) => ({ id: e.id, score: e.score, createdAt: e.createdAt }))} />
      </main>
      <SiteFooter lang={lang} />
    </>
  );
}
