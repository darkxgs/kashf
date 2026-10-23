import "server-only";
import type { Agent } from "undici";
import { detectPlatform, PLATFORM_HOSTS } from "@/lib/platforms";
import type { AssetFact, Facts, PageFacts, StepKey } from "@/lib/types";
import { sameSite, siteOf } from "@/lib/url";
import { FetchError, IMAGE_ACCEPT, fetchUrl, makeAgent, measureAsset, readCertificate } from "./fetcher";
import { parsePage } from "./parse";

export type AuditErrorCode = "blocked" | "timeout" | "dns" | "refused" | "tls" | "network" | "challenge" | "http_error" | "not_html";

export class AuditError extends Error {
  constructor(
    public code: AuditErrorCode,
    public status?: number,
  ) {
    super(code);
  }
}

export type CollectOptions = { allowPrivate: boolean; onStep?: (key: StepKey, note?: string) => unknown };

async function pool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

const cacheSeconds = (cc: string | undefined): number | null => {
  if (!cc) return null;
  if (/no-store|no-cache/i.test(cc)) return 0;
  if (/immutable/i.test(cc)) return 31_536_000;
  const m = cc.match(/max-age=(\d+)/i);
  return m ? Number(m[1]) : null;
};

const isChallenge = (status: number, headers: Record<string, string>, body: string) =>
  (status === 403 || status === 503 || status === 429) &&
  (!!headers["cf-mitigated"] || /challenge-platform|cf-chl|_cf_chl|Attention Required|captcha|px-captcha|perimeterx|akamai/i.test(body.slice(0, 20_000)));

/** Picks a product page from the home page's links, by the URL shapes stores use. */
export function findProductLink(home: PageFacts): string | null {
  const shapes = [/\/products?\/[^/?#]+/i, /\/p\/[^/?#]+/i, /\/[^/]+\/p\d{3,}(\/|$)/i, /\/item\/[^/?#]+/i, /\/shop\/[^/?#]+\/[^/?#]+/i];
  for (const re of shapes) {
    const hit = home.links.find((l) => l.internal && re.test(new URL(l.href).pathname) && !/\/(collections|categories|category|cart|checkout)\/?$/i.test(l.href));
    if (hit) return hit.href.split("#")[0];
  }
  return null;
}

/** A spread of internal links worth following for the broken-link check. */
function linkSample(home: PageFacts, base: string, max = 25): string[] {
  const seen = new Set<string>([base.replace(/\/$/, "")]);
  const out: string[] = [];
  for (const l of home.links) {
    if (!l.internal) continue;
    const u = new URL(l.href);
    u.hash = "";
    const key = u.toString().replace(/\/$/, "");
    if (seen.has(key) || /\/(cart|checkout|account|login|logout|signin|signup|register|wishlist|search)(\/|\?|$)/i.test(u.pathname) || /\.(pdf|zip|jpg|png|webp)$/i.test(u.pathname)) continue;
    seen.add(key);
    out.push(u.toString());
    if (out.length >= max) break;
  }
  return out;
}

export type RobotRules = { allow: string[]; disallow: string[] };

/** The rules that apply to every crawler ("User-agent: *"), plus any sitemaps listed. */
export function robotsFacts(text: string) {
  const sitemaps: string[] = [];
  const rules: RobotRules = { allow: [], disallow: [] };
  let agents: string[] = [];
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "sitemap") {
      if (value) sitemaps.push(value);
      continue;
    }
    if (key === "user-agent") {
      agents = lastWasAgent ? [...agents, value] : [value];
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!agents.includes("*")) continue;
    if (key === "disallow" && value) rules.disallow.push(value);
    if (key === "allow" && value) rules.allow.push(value);
  }
  return { sitemaps, rules, disallowAll: !robotsAllows(rules, "/") && !robotsAllows(rules, "/index.html") };
}

const patternToRe = (p: string) => new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$")}`);

/** Google's rule: the longest matching pattern wins, and Allow wins a tie. */
export function robotsAllows(rules: RobotRules, path: string): boolean {
  let best = { len: -1, allow: true };
  for (const [list, allow] of [
    [rules.disallow, false],
    [rules.allow, true],
  ] as const) {
    for (const p of list) {
      if (!patternToRe(p).test(path)) continue;
      if (p.length > best.len || (p.length === best.len && allow)) best = { len: p.length, allow };
    }
  }
  return best.allow;
}

/** Everything an audit measures, in five stages, reporting progress after each. */
export async function collect(rawUrl: string, o: CollectOptions): Promise<Facts> {
  const agent = makeAgent(o.allowPrivate);
  try {
    return await run(rawUrl, o, agent);
  } finally {
    agent.close().catch(() => {});
  }
}

async function run(rawUrl: string, o: CollectOptions, agent: Agent): Promise<Facts> {
  const opts = { agent, allowPrivate: o.allowPrivate };

  /* 1. The home page */
  let home;
  try {
    home = await fetchUrl(rawUrl, { ...opts, timeoutMs: 15_000 });
  } catch (e) {
    throw new AuditError(e instanceof FetchError ? e.code : "network");
  }
  const htmlText = home.body?.toString("utf8") ?? "";
  if (isChallenge(home.status, home.headers, htmlText)) throw new AuditError("challenge", home.status);
  if (home.status >= 400) throw new AuditError("http_error", home.status);
  const ctype = home.headers["content-type"] ?? "";
  if (ctype && !/html|xml/i.test(ctype)) throw new AuditError("not_html", home.status);
  const page = parsePage(htmlText, home.url);
  const finalUrl = new URL(home.url);
  await o.onStep?.("home", page.title ?? finalUrl.host);

  /* 2. Security: certificate and the http:// redirect */
  const https = finalUrl.protocol === "https:";
  const [cert, httpToHttps] = await Promise.all([
    https ? readCertificate(home.url, o.allowPrivate) : Promise.resolve(null),
    https
      ? fetchUrl(`http://${finalUrl.host}/`, { ...opts, follow: false, readBody: false, timeoutMs: 6_000 })
          .then((r) => [301, 302, 303, 307, 308].includes(r.status) && /^https:\/\//i.test(r.headers.location ?? ""))
          .catch(() => null)
      : Promise.resolve(null),
  ]);
  await o.onStep?.("security");

  /* 3. Assets the home page references */
  const candidates: { url: string; kind: AssetFact["kind"] }[] = [
    ...page.images.slice(0, 30).map((i) => ({ url: i.src, kind: "image" as const })),
    ...page.scripts.slice(0, 25).map((s) => ({ url: s.src!, kind: "script" as const })),
    ...page.styles.slice(0, 12).map((u) => ({ url: u, kind: "style" as const })),
    ...page.fonts.slice(0, 6).map((u) => ({ url: u, kind: "font" as const })),
  ];
  const unique = [...new Map(candidates.map((c) => [c.url, c])).values()];
  const assets: AssetFact[] = await pool(unique, 8, async (c) => {
    const r = await measureAsset(c.url, { ...opts, accept: c.kind === "image" ? IMAGE_ACCEPT : "*/*" });
    const host = new URL(c.url).hostname;
    return {
      url: c.url,
      kind: c.kind,
      bytes: r && r.status < 400 ? r.transferBytes : null,
      type: r?.headers["content-type"]?.split(";")[0].trim() ?? null,
      cacheSeconds: r ? cacheSeconds(r.headers["cache-control"]) : null,
      firstParty: sameSite(host, finalUrl.hostname),
      status: r?.status ?? null,
    };
  });
  await o.onStep?.("assets", String(assets.filter((a) => a.bytes != null).length));

  /* 4. robots.txt, sitemap, favicon and a sample of links */
  const origin = finalUrl.origin;
  const robotsRes = await fetchUrl(`${origin}/robots.txt`, { ...opts, maxBytes: 200_000, timeoutMs: 8_000 }).catch(() => null);
  const robotsOk = !!robotsRes && robotsRes.status === 200 && !/<html/i.test(robotsRes.body?.toString("utf8").slice(0, 500) ?? "");
  const parsedRobots = robotsOk ? robotsFacts(robotsRes!.body!.toString("utf8")) : null;
  const sitemapUrl = parsedRobots?.sitemaps[0] ?? `${origin}/sitemap.xml`;
  const sitemapRes = await fetchUrl(sitemapUrl, { ...opts, maxBytes: 300_000, timeoutMs: 8_000, accept: "application/xml,text/xml,*/*" }).catch(() => null);
  const sitemapOk = !!sitemapRes && sitemapRes.status === 200 && /<(urlset|sitemapindex)\b/i.test(sitemapRes.body?.toString("utf8").slice(0, 300_000) ?? "");
  const faviconOk = page.icon
    ? true
    : await fetchUrl(`${origin}/favicon.ico`, { ...opts, method: "HEAD", timeoutMs: 6_000 })
        .then((r) => r.status === 200)
        .catch(() => false);
  const sample = linkSample(page, home.url);
  const checked = await pool(sample, 6, async (u) => {
    try {
      let r = await fetchUrl(u, { ...opts, method: "HEAD", timeoutMs: 8_000 });
      if (r.status === 405 || r.status === 403 || r.status === 501) r = await fetchUrl(u, { ...opts, timeoutMs: 8_000, maxBytes: 50_000 });
      return { url: u, status: r.status as number | null };
    } catch (e) {
      return { url: u, status: e instanceof FetchError && e.code === "timeout" ? -1 : null };
    }
  });
  const broken = checked.filter((c) => c.status === null || (c.status != null && c.status >= 400)).map((c) => ({ url: c.url, status: c.status }));
  await o.onStep?.("crawl");

  /* 5. One product page, if we can find one */
  let product: PageFacts | null = null;
  const productUrl = findProductLink(page);
  if (productUrl) {
    try {
      const pr = await fetchUrl(productUrl, { ...opts, timeoutMs: 12_000 });
      if (pr.status < 400 && pr.body) product = parsePage(pr.body.toString("utf8"), pr.url);
    } catch {
      product = null;
    }
  }
  await o.onStep?.("product", product?.title ?? undefined);

  const pathOf = (u: string) => {
    const x = new URL(u);
    return `${x.pathname}${x.search}`;
  };
  const robots = parsedRobots
    ? {
        found: true,
        disallowAll: parsedRobots.disallowAll,
        blocksHome: !robotsAllows(parsedRobots.rules, pathOf(home.url)),
        blocksProduct: !!product && !robotsAllows(parsedRobots.rules, pathOf(product.url)),
        sitemaps: parsedRobots.sitemaps,
      }
    : { found: false, disallowAll: false, blocksHome: false, blocksProduct: false, sitemaps: [] };

  const thirdParties = [
    ...new Set(page.scripts.map((s) => s.host).filter((h): h is string => !!h && !sameSite(h, finalUrl.hostname) && !PLATFORM_HOSTS.test(siteOf(h)))),
  ];

  return {
    requestedUrl: rawUrl,
    finalUrl: home.url,
    redirects: home.redirects,
    status: home.status,
    ttfbMs: home.ttfbMs,
    totalMs: home.totalMs,
    headers: pickHeaders(home.headers),
    encoding: home.encoding,
    htmlBytes: home.body?.byteLength ?? 0,
    transferBytes: home.transferBytes,
    https,
    httpToHttps,
    cert: cert ? { validTo: cert.validTo.toISOString(), issuer: cert.issuer, daysLeft: Math.floor((cert.validTo.getTime() - Date.now()) / 86_400_000) } : null,
    platform: detectPlatform(htmlText, home.headers),
    home: page,
    assets,
    robots,
    sitemap: { url: sitemapOk ? sitemapUrl : null, ok: sitemapOk },
    faviconOk,
    links: { checked: checked.length, broken },
    product,
    thirdParties,
  };
}

const KEEP = ["server", "x-powered-by", "strict-transport-security", "x-content-type-options", "x-frame-options", "content-security-policy", "referrer-policy", "x-robots-tag", "cache-control", "content-type", "content-encoding", "cf-cache-status", "x-cache", "via", "x-shopid", "powered-by"];
const pickHeaders = (h: Record<string, string>) => Object.fromEntries(KEEP.filter((k) => h[k] != null).map((k) => [k, h[k].slice(0, 500)]));
