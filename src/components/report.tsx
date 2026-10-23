import type { ReactNode } from "react";
import type { Audit } from "@/db/schema";
import { CATEGORIES, prescription, verdictOf, type Verdict } from "@/lib/checks";
import { fixOf, platformNoteOf, titleOf, whyOf } from "@/lib/copy";
import { bytes, dateOnly, ms } from "@/lib/format";
import { dict } from "@/lib/i18n";
import { PLATFORM_NAMES } from "@/lib/platforms";
import type { Facts, Finding, Lang, Metric, Psi, Status } from "@/lib/types";
import { displayHost, hostAndPath } from "@/lib/url";
import { checkUrl } from "@/app/[lang]/actions";
import { CopyLink, PrintButton, PsiWatcher } from "./report-parts";
import { buttonClass, Chip, cn, STATUS_STYLE, StatusMark } from "./ui";

const VERDICT_TONE: Record<Verdict, string> = { healthy: "text-pass", good: "text-pass", attention: "text-warn", poor: "text-fail" };
const tone = (s: number) => (s >= 85 ? "pass" : s >= 70 ? "pass" : s >= 50 ? "warn" : "fail") as Status;

const ORDER: Record<Status, number> = { fail: 0, warn: 1, info: 2, pass: 3, skip: 4 };

function metricText(m: Metric, lang: Lang): string {
  if (m.unit === "ms") return ms(m.value, lang);
  if (m.unit === "bytes") return bytes(m.value, lang);
  if (m.unit === "pct") return `${m.value}%`;
  return String(m.value);
}

function thresholdText(m: Metric, lang: Lang): string {
  const t = dict(lang).report;
  const v = (x: number) => metricText({ ...m, value: x }, lang);
  return m.better === "lower" ? (m.good === 0 ? (lang === "ar" ? "لا شيء" : "none") : t.under(v(m.good))) : t.over(v(m.good));
}

/**
 * A lab-report reference range: the good, borderline and poor zones, with a
 * marker where this store's value falls. Mirrors itself in Arabic.
 */
export function RangeBar({ m, lang }: { m: Metric; lang: Lang }) {
  const t = dict(lang).report;
  const lower = m.better === "lower";
  const max = m.unit === "pct" || m.unit === "score" ? 100 : Math.max(m.poor * 1.5, m.value * 1.08, 1);
  const at = (x: number) => Math.min(100, Math.max(0, (x / max) * 100));
  const zones = lower
    ? [
        { w: at(m.good), c: "bg-pass/35" },
        { w: at(m.poor) - at(m.good), c: "bg-warn/35" },
        { w: 100 - at(m.poor), c: "bg-fail/30" },
      ]
    : [
        { w: at(m.poor), c: "bg-fail/30" },
        { w: at(m.good) - at(m.poor), c: "bg-warn/35" },
        { w: 100 - at(m.good), c: "bg-pass/35" },
      ];
  return (
    <div className="w-full max-w-[260px]" aria-hidden>
      <div className="relative h-[18px]">
        <div className="absolute inset-x-0 top-[7px] flex h-1 overflow-hidden rounded-full">
          {zones.map((z, i) => (
            <span key={i} className={z.c} style={{ width: `${Math.max(0, z.w)}%` }} />
          ))}
        </div>
        <span className="absolute top-0 h-[18px] w-[3px] -translate-x-1/2 rounded-full bg-ink rtl:translate-x-1/2" style={{ insetInlineStart: `${at(m.value)}%` }} />
      </div>
      <div className="mt-1 flex justify-between gap-2 text-[12px] text-muted tnum">
        <span>
          {t.yours}: <span className="font-medium text-ink">{metricText(m, lang)}</span>
        </span>
        <span>
          {t.good}: {thresholdText(m, lang)}
        </span>
      </div>
    </div>
  );
}

function statusLabel(s: Status, lang: Lang) {
  const t = dict(lang).report;
  return s === "pass" ? t.passed : s === "warn" ? t.needsWork : s === "fail" ? t.problem : t.note;
}

function Explain({ f, lang, platform }: { f: Finding; lang: Lang; platform: Facts["platform"] }) {
  const t = dict(lang).report;
  const note = platformNoteOf(f.id, platform, lang);
  return (
    <div className="grid gap-3 text-[14.5px] leading-relaxed">
      <p>
        <span className="font-medium text-ink">{t.why}. </span>
        <span className="text-ink-2">{whyOf(f.id, lang)}</span>
      </p>
      {f.status !== "pass" ? (
        <p>
          <span className="font-medium text-ink">{t.fix}. </span>
          <span className="text-ink-2">{fixOf(f.id, lang)}</span>
          {note && platform ? (
            <span className="mt-1.5 block rounded-control bg-pen-soft/70 px-3 py-2 text-[14px] text-pen-deep">
              <span className="font-medium">{t.onPlatform(PLATFORM_NAMES[platform][lang])}: </span>
              {note}
            </span>
          ) : null}
        </p>
      ) : null}
      {f.items?.length ? (
        <ul className="grid gap-1 rounded-control bg-well px-3 py-2.5 text-[13.5px]">
          {f.items.map((it, i) => (
            <li key={i} className="flex min-w-0 items-baseline justify-between gap-4">
              {it.href ? (
                <a href={it.href} target="_blank" rel="noreferrer nofollow" className="ltr min-w-0 truncate text-ink-2 underline-offset-2 hover:underline">
                  {it.label}
                </a>
              ) : (
                <span className="ltr min-w-0 truncate text-ink-2">{it.label}</span>
              )}
              {it.value ? <span className="shrink-0 text-muted tnum">{/^\d+$/.test(it.value) ? bytes(Number(it.value), lang) : it.value}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function FindingRow({ f, lang, platform }: { f: Finding; lang: Lang; platform: Facts["platform"] }) {
  return (
    <details className="group print-break border-b border-rule-2 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-start gap-3 py-3.5 [&::-webkit-details-marker]:hidden">
        <StatusMark status={f.status} label={statusLabel(f.status, lang)} className="mt-[3px]" />
        <span className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6">
          <span className="text-[15px] leading-snug text-ink">{titleOf(f, lang)}</span>
          {f.metric ? <RangeBar m={f.metric} lang={lang} /> : null}
        </span>
        <svg viewBox="0 0 16 16" className="mt-1 size-4 shrink-0 text-faint transition-transform duration-200 group-open:rotate-180 no-print" aria-hidden>
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="pb-4 ps-[34px]">
        <Explain f={f} lang={lang} platform={platform} />
      </div>
    </details>
  );
}

function Section({ title, aside, children, className }: { title: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("border-t border-rule pt-8", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="text-[21px] font-semibold tracking-[-0.01em]">{title}</h2>
        {aside ? <div className="text-[13.5px] text-muted">{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}

function Weights({ facts, lang }: { facts: Facts; lang: Lang }) {
  const sum = (k: string) => facts.assets.filter((a) => a.kind === k && a.bytes != null).reduce((s, a) => s + (a.bytes ?? 0), 0);
  const parts = [
    { k: lang === "ar" ? "الصور" : "Images", v: sum("image"), c: "bg-pen" },
    { k: lang === "ar" ? "السكربتات" : "Scripts", v: sum("script"), c: "bg-ink-2" },
    { k: lang === "ar" ? "التنسيقات" : "Styles", v: sum("style"), c: "bg-faint" },
    { k: lang === "ar" ? "الخطوط" : "Fonts", v: sum("font"), c: "bg-warn/70" },
    { k: "HTML", v: facts.transferBytes, c: "bg-rule" },
  ].filter((p) => p.v > 0);
  const total = parts.reduce((s, p) => s + p.v, 0);
  if (!total) return null;
  return (
    <div className="mt-2">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-rule-2">
        {parts.map((p) => (
          <span key={p.k} className={p.c} style={{ width: `${(p.v / total) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-2.5 grid gap-1 text-[13px]">
        {parts.map((p) => (
          <li key={p.k} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-ink-2">
              <span className={cn("size-2 rounded-full", p.c)} />
              {p.k}
            </span>
            <span className="text-muted tnum">{bytes(p.v, lang)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PsiBlock({ audit, lang }: { audit: Audit; lang: Lang }) {
  const t = dict(lang).report;
  const psi = audit.psi as Psi | null;
  if (audit.psiStatus === "skipped" || !audit.psiStatus) return null;
  return (
    <div className="border-t border-rule-2 py-5">
      <h3 className="text-[14px] font-medium text-muted">{t.psi}</h3>
      {audit.psiStatus === "running" ? (
        <p className="mt-2 flex items-start gap-2 text-[14px] text-ink-2">
          <PsiWatcher id={audit.id} />
          <svg viewBox="0 0 16 16" className="mt-1 size-4 shrink-0 animate-spin text-pen" aria-hidden>
            <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
            <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {t.psiRunning}
        </p>
      ) : audit.psiStatus === "failed" || !psi || psi.score == null ? (
        <p className="mt-2 text-[14px] text-muted">{t.psiFailed}</p>
      ) : (
        <>
          <p className={cn("mt-1 text-[40px] leading-none font-semibold tnum", STATUS_STYLE[psi.score >= 90 ? "pass" : psi.score >= 50 ? "warn" : "fail"].text)}>{psi.score}</p>
          <dl className="mt-3 grid gap-1.5 text-[13.5px]">
            <p className="text-[12.5px] text-faint">{t.psiLab}</p>
            {psi.lcpMs != null ? <Row k={t.lcp} v={ms(psi.lcpMs, lang)} /> : null}
            {psi.tbtMs != null ? <Row k={t.tbt} v={ms(psi.tbtMs, lang)} /> : null}
            {psi.cls != null ? <Row k={t.cls} v={psi.cls.toFixed(2)} /> : null}
            {psi.field && (psi.field.lcpMs != null || psi.field.inpMs != null) ? (
              <>
                <p className="mt-2 text-[12.5px] text-faint">{t.psiField}</p>
                {psi.field.lcpMs != null ? <Row k={t.lcp} v={ms(psi.field.lcpMs, lang)} /> : null}
                {psi.field.inpMs != null ? <Row k={t.inp} v={ms(psi.field.inpMs, lang)} /> : null}
                {psi.field.cls != null ? <Row k={t.cls} v={psi.field.cls.toFixed(2)} /> : null}
              </>
            ) : null}
          </dl>
        </>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-2">{k}</dt>
      <dd className="text-end text-ink tnum">{v}</dd>
    </div>
  );
}

function History({ lang, current, earlier }: { lang: Lang; current: number; earlier: { id: string; score: number | null; createdAt: Date }[] }) {
  const t = dict(lang).report;
  const pts = [...earlier].reverse().map((e) => e.score ?? 0);
  pts.push(current);
  const prev = earlier[0]?.score;
  return (
    <div className="border-t border-rule-2 py-5">
      <h3 className="text-[14px] font-medium text-muted">{t.history}</h3>
      {earlier.length ? (
        <>
          <p className="mt-1.5 text-[14px] text-ink-2">{prev != null ? t.since(current - prev) : null}</p>
          <svg viewBox={`0 0 ${Math.max(1, pts.length - 1) * 40} 60`} className="mt-3 h-14 w-full rtl:-scale-x-100" preserveAspectRatio="none" aria-hidden>
            <polyline
              points={pts.map((p, i) => `${i * 40},${56 - (p / 100) * 52}`).join(" ")}
              fill="none"
              stroke="var(--color-pen)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
          </svg>
          <ul className="mt-2 grid gap-1 text-[13.5px]">
            {earlier.slice(0, 4).map((e) => (
              <li key={e.id} className="flex justify-between gap-3">
                <a href={`/${lang}/r/${e.id}`} className="text-ink-2 underline-offset-2 hover:underline">
                  {dateOnly(e.createdAt, lang)}
                </a>
                <span className="text-muted tnum">{e.score}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{t.historyNone}</p>
      )}
    </div>
  );
}

export function Report({ audit, lang, earlier }: { audit: Audit; lang: Lang; earlier: { id: string; score: number | null; createdAt: Date }[] }) {
  const t = dict(lang);
  const r = t.report;
  const facts = audit.facts!;
  const findings = audit.findings ?? [];
  const overall = audit.score ?? 0;
  const verdict = verdictOf(overall);
  const rx = prescription(findings);
  const fails = findings.filter((f) => f.status === "fail" && f.weight > 0).length;
  const warns = findings.filter((f) => f.status === "warn" && f.weight > 0).length;
  const platform = facts.platform;
  const measured = facts.assets.filter((a) => a.bytes != null);
  const weight = facts.transferBytes + measured.reduce((s, a) => s + (a.bytes ?? 0), 0);
  const target = hostAndPath(facts.finalUrl);

  return (
    <article className="mx-auto max-w-6xl px-3 sm:px-8">
      <div className="overflow-hidden rounded-sheet border border-rule bg-paper shadow-[0_1px_0_rgb(20_27_45/0.03),0_20px_50px_-24px_rgb(20_27_45/0.18)]">
        {/* Header: the store, and the result */}
        <header className="grid gap-8 border-b border-rule px-5 py-7 sm:px-10 sm:py-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <p className="text-[13.5px] font-medium text-pen">{r.kicker}</p>
            <h1 className="mt-1.5 text-[30px] leading-tight font-semibold tracking-[-0.02em] [overflow-wrap:anywhere] sm:text-[42px]">
              <bdi dir="ltr">{target.host}</bdi>
            </h1>
            {target.path ? (
              <p className="mt-1 truncate text-[15px] text-muted">
                <bdi dir="ltr">{target.path}</bdi>
              </p>
            ) : null}
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[14.5px] text-ink-2">
              <span>{r.checked(dateOnly(audit.createdAt, lang))}</span>
              {platform ? <Chip>{PLATFORM_NAMES[platform][lang]}</Chip> : null}
            </p>
            <div className="no-print mt-5 flex flex-wrap gap-2">
              <form action={checkUrl}>
                <input type="hidden" name="url" value={audit.url} />
                <input type="hidden" name="lang" value={lang} />
                <input type="hidden" name="fresh" value="1" />
                <button type="submit" className={buttonClass("pen", "sm")}>
                  {r.again}
                </button>
              </form>
              <CopyLink label={r.copy} done={r.copied} />
              <PrintButton label={r.print} />
            </div>
          </div>
          <div className="flex items-end gap-5 lg:flex-col lg:items-end lg:gap-1 lg:text-end">
            <p className={cn("text-[84px] leading-[0.85] font-semibold tracking-[-0.04em] tnum sm:text-[104px]", VERDICT_TONE[verdict])}>{overall}</p>
            <div className="pb-1 lg:pb-0">
              <p className="text-[13.5px] text-muted">{r.outOf}</p>
              <p className="mt-1 max-w-[280px] text-[15px] leading-snug font-medium">{r.verdict[verdict]}</p>
              <p className="mt-0.5 text-[13.5px] text-muted">{r.counts(fails, warns)}</p>
            </div>
          </div>
        </header>

        {audit.isDemo ? <p className="border-b border-rule bg-pen-soft/50 px-5 py-3 text-[14px] text-pen-deep sm:px-10">{r.demoNote}</p> : null}

        {/* Vitals: one figure per area */}
        <div className="grid grid-cols-2 gap-px border-b border-rule bg-rule-2 sm:grid-cols-5">
          {CATEGORIES.map((c, i) => {
            const v = audit.scores?.[c];
            return (
              <a key={c} href={`#${c}`} className="group block bg-paper px-5 py-5 transition-colors last:col-span-2 hover:bg-well sm:px-6 sm:last:col-span-1">
                <p className="text-[13.5px] text-muted">{t.categories[c]}</p>
                <p className={cn("mt-1 text-[30px] leading-none font-semibold tnum", v == null ? "text-faint" : STATUS_STYLE[tone(v)].text)}>{v ?? "–"}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-rule-2">
                  <span
                    className={cn("block h-full origin-left animate-fill rounded-full rtl:origin-right", v == null ? "" : STATUS_STYLE[tone(v)].solid)}
                    style={{ width: `${v ?? 0}%`, animationDelay: `${120 + i * 70}ms` }}
                  />
                </div>
              </a>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 px-5 py-8 sm:px-10">
            {/* The prescription */}
            <section>
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <h2 className="text-[24px] font-semibold tracking-[-0.01em] text-pen-deep">{r.rx}</h2>
                <p className="text-[13.5px] text-muted">{r.rxSub}</p>
              </div>
              {rx.length ? (
                <ol className="mt-5 grid gap-0">
                  {rx.map((f, i) => {
                    const note = platformNoteOf(f.id, platform, lang);
                    return (
                      <li key={f.id} className="print-break grid grid-cols-[36px_minmax(0,1fr)] gap-x-3 border-b border-dashed border-rule py-5 first:pt-1 last:border-b-0">
                        <span className="text-[28px] leading-none font-semibold text-pen tnum">{i + 1}</span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="me-1 text-[17px] leading-snug font-semibold">{titleOf(f, lang)}</h3>
                            <Chip className={cn(STATUS_STYLE[f.status].soft, STATUS_STYLE[f.status].text)}>{t.categories[f.category]}</Chip>
                            <Chip>{t.effort[f.effort]}</Chip>
                          </div>
                          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{whyOf(f.id, lang)}</p>
                          <p className="mt-2 text-[15px] leading-relaxed">
                            <span className="font-medium">{r.fix}: </span>
                            {fixOf(f.id, lang)}
                          </p>
                          {note && platform ? (
                            <p className="mt-2 rounded-control bg-pen-soft/70 px-3 py-2 text-[14px] text-pen-deep">
                              <span className="font-medium">{r.onPlatform(PLATFORM_NAMES[platform][lang])}: </span>
                              {note}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="mt-4 text-[15px] text-ink-2">{r.rxNone}</p>
              )}
            </section>

            {/* Every finding, by area */}
            {CATEGORIES.map((c) => {
              const list = findings.filter((f) => f.category === c).sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.weight - a.weight);
              if (!list.length) return null;
              return (
                <Section key={c} title={<span id={c} className="scroll-mt-6">{t.categories[c]}</span>} aside={t.categoryBlurb[c]} className="mt-10">
                  <div className="mt-2">
                    {list.map((f) => (
                      <FindingRow key={f.id} f={f} lang={lang} platform={platform} />
                    ))}
                  </div>
                </Section>
              );
            })}
          </div>

          {/* Side: the store's measurements, Google's test, follow-up */}
          <aside className="border-t border-rule bg-well/60 px-5 py-6 sm:px-8 lg:border-s lg:border-t-0">
            <div className="lg:sticky lg:top-6">
              <h3 className="text-[14px] font-medium text-muted">{r.store}</h3>
              <dl className="mt-2.5 grid gap-1.5 text-[14px]">
                <Row k={r.response} v={ms(facts.ttfbMs, lang)} />
                <Row k={r.weight} v={bytes(weight, lang)} />
                <Row k={r.files} v={measured.length} />
                <Row k={r.redirects} v={facts.redirects.length} />
                <Row k={r.thirdParties} v={facts.thirdParties.length} />
              </dl>
              <Weights facts={facts} lang={lang} />
              <div className="mt-5">
                <h4 className="text-[13px] text-muted">{r.tools}</h4>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {facts.home.tools.length ? facts.home.tools.map((x) => <Chip key={x}>{x}</Chip>) : <span className="text-[13.5px] text-ink-2">{r.none}</span>}
                </div>
              </div>
              <div className="mt-5 pb-5">
                <h4 className="text-[13px] text-muted">{r.productPage}</h4>
                {facts.product ? (
                  <a href={facts.product.url} target="_blank" rel="noreferrer nofollow" className="ltr mt-1 block truncate text-[13.5px] text-ink-2 underline-offset-2 hover:underline">
                    {displayHost(facts.product.url)}
                  </a>
                ) : (
                  <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{r.noProduct}</p>
                )}
              </div>
              <PsiBlock audit={audit} lang={lang} />
              <History lang={lang} current={overall} earlier={earlier} />
              <div className="no-print mt-1 rounded-card bg-pen px-5 py-5 text-white">
                <p className="text-[16px] font-semibold">{r.help}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-white/80">{r.helpBody}</p>
                <a href="https://www.seifashraf.dev/contact" className={buttonClass("outline", "sm", "mt-3 border-white/30 bg-white text-pen-deep hover:bg-white/90")}>
                  {r.helpCta}
                </a>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </article>
  );
}
