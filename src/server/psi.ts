import "server-only";
import type { Psi } from "@/lib/types";

type Lighthouse = {
  lighthouseResult?: { categories?: { performance?: { score?: number | null } }; audits?: Record<string, { numericValue?: number }> };
  loadingExperience?: { overall_category?: string; metrics?: Record<string, { percentile?: number }> };
};

/**
 * Google's own speed test (PageSpeed Insights, mobile). Optional: it takes 15
 * to 40 seconds and Google rate-limits requests without an API key, so the
 * report shows it when it arrives and does without it otherwise.
 */
export async function runPsi(url: string): Promise<Psi | null> {
  const key = process.env.PAGESPEED_API_KEY;
  const api = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  api.searchParams.set("url", url);
  api.searchParams.set("strategy", "mobile");
  api.searchParams.set("category", "performance");
  if (key) api.searchParams.set("key", key);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 55_000);
  try {
    const res = await fetch(api, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return null;
    const j = (await res.json()) as Lighthouse;
    const a = j.lighthouseResult?.audits ?? {};
    const raw = j.lighthouseResult?.categories?.performance?.score;
    const field = j.loadingExperience?.metrics;
    return {
      score: raw == null ? null : Math.round(raw * 100),
      lcpMs: a["largest-contentful-paint"]?.numericValue ?? null,
      tbtMs: a["total-blocking-time"]?.numericValue ?? null,
      cls: a["cumulative-layout-shift"]?.numericValue ?? null,
      fcpMs: a["first-contentful-paint"]?.numericValue ?? null,
      field: field
        ? {
            lcpMs: field.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
            inpMs: field.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
            cls: field.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile != null ? field.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100 : null,
            category: j.loadingExperience?.overall_category ?? null,
          }
        : null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
