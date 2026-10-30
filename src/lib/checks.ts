// The check-up itself: pure functions from measured facts to findings and
// scores. Nothing here touches the network, so every rule is unit-tested and
// old reports can be re-scored when a rule changes.
import type { Category, Effort, Facts, Finding, FindingItem, Metric, Scores, Status } from "./types";

const KB = 1024;
const MB = 1024 * 1024;

export const CATEGORY_WEIGHTS: Record<Category, number> = { speed: 0.25, search: 0.25, trust: 0.25, mobile: 0.15, security: 0.1 };
export const CATEGORIES: Category[] = ["speed", "search", "trust", "mobile", "security"];

/** Where a value falls between "good" and "poor" thresholds. */
export function grade(value: number, good: number, poor: number, better: "lower" | "higher"): Exclude<Status, "info" | "skip"> {
  if (better === "lower") return value <= good ? "pass" : value > poor ? "fail" : "warn";
  return value >= good ? "pass" : value < poor ? "fail" : "warn";
}

const metric = (value: number, unit: Metric["unit"], good: number, poor: number, better: Metric["better"] = "lower"): Metric => ({ value, unit, good, poor, better });

const fileName = (u: string) => {
  try {
    const p = new URL(u).pathname.split("/").filter(Boolean).pop() ?? u;
    return decodeURIComponent(p).slice(0, 60);
  } catch {
    return u.slice(0, 60);
  }
};

/** Store builders whose chat and call buttons are added by script after the page loads. */
const SCRIPT_DRAWN = new Set(["salla", "zid", "shopify", "youcan", "expandcart", "wix"]);
const scriptDrawn = (f: Facts) => !!f.platform && SCRIPT_DRAWN.has(f.platform);

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

type Def = { id: string; category: Category; weight: number; effort: Effort; run: (f: Facts) => Omit<Finding, "id" | "category" | "weight" | "effort"> | null };

const DEFS: Def[] = [
  /* ------------------------------- speed ------------------------------- */
  {
    id: "ttfb",
    category: "speed",
    weight: 3,
    effort: "dev",
    run: (f) => ({ status: grade(f.ttfbMs, 600, 1500, "lower"), metric: metric(f.ttfbMs, "ms", 600, 1500), vars: { redirects: f.redirects.length } }),
  },
  {
    id: "page_weight",
    category: "speed",
    weight: 4,
    effort: "medium",
    run: (f) => {
      const measured = f.assets.filter((a) => a.bytes != null);
      if (measured.length < 2) return null;
      const total = f.transferBytes + measured.reduce((s, a) => s + (a.bytes ?? 0), 0);
      const top = [...measured].sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0)).slice(0, 5);
      return {
        status: grade(total, 2.5 * MB, 5 * MB, "lower"),
        metric: metric(total, "bytes", 2.5 * MB, 5 * MB),
        items: top.map((a) => ({ label: fileName(a.url), value: String(a.bytes), href: a.url })),
      };
    },
  },
  {
    id: "heavy_images",
    category: "speed",
    weight: 3,
    effort: "quick",
    run: (f) => {
      const imgs = f.assets.filter((a) => a.kind === "image" && a.bytes != null);
      if (!imgs.length) return null;
      const heavy = imgs.filter((a) => a.bytes! > 300 * KB).sort((a, b) => b.bytes! - a.bytes!);
      const biggest = heavy[0]?.bytes ?? 0;
      const status: Status = !heavy.length ? "pass" : biggest > MB || heavy.length >= 4 ? "fail" : "warn";
      return { status, vars: { n: heavy.length, max: biggest }, items: heavy.slice(0, 8).map((a) => ({ label: fileName(a.url), value: String(a.bytes), href: a.url })) };
    },
  },
  {
    id: "image_formats",
    category: "speed",
    weight: 2,
    effort: "quick",
    run: (f) => {
      const imgs = f.assets.filter((a) => a.kind === "image" && a.type?.startsWith("image/") && a.type !== "image/svg+xml" && a.type !== "image/gif");
      if (imgs.length < 3) return null;
      const modern = imgs.filter((a) => /webp|avif/.test(a.type ?? "")).length;
      const p = pct(modern, imgs.length);
      return { status: grade(p, 70, 30, "higher"), metric: metric(p, "pct", 70, 30, "higher"), vars: { pct: p, n: imgs.length } };
    },
  },
  {
    id: "render_blocking",
    category: "speed",
    weight: 2,
    effort: "dev",
    run: (f) => {
      const blocking = f.home.scripts.filter((s) => s.blocking);
      return {
        status: grade(blocking.length, 2, 6, "lower"),
        metric: metric(blocking.length, "count", 2, 6),
        vars: { n: blocking.length },
        items: blocking.slice(0, 10).map((s) => ({ label: fileName(s.src!), value: s.host ?? undefined, href: s.src! })),
      };
    },
  },
  {
    id: "compression",
    category: "speed",
    weight: 2,
    effort: "dev",
    run: (f) => {
      if (f.htmlBytes < 5 * KB) return null;
      const enc = (f.encoding ?? "").toLowerCase();
      return { status: enc === "br" || enc === "gzip" || enc === "deflate" || enc === "zstd" ? "pass" : "fail", vars: { enc: enc === "br" ? "Brotli" : enc || "none" } };
    },
  },
  {
    id: "html_size",
    category: "speed",
    weight: 1,
    effort: "dev",
    run: (f) => ({ status: grade(f.htmlBytes, 150 * KB, 500 * KB, "lower"), metric: metric(f.htmlBytes, "bytes", 150 * KB, 500 * KB) }),
  },
  {
    id: "lazy_images",
    category: "speed",
    weight: 1,
    effort: "dev",
    run: (f) => {
      const n = f.home.images.length;
      if (n <= 8) return null;
      const lazy = f.home.images.filter((i) => i.lazy).length;
      return { status: lazy > 0 ? "pass" : "warn", vars: { n, lazy } };
    },
  },
  {
    id: "image_dimensions",
    category: "speed",
    weight: 1,
    effort: "dev",
    run: (f) => {
      const n = f.home.images.length;
      if (n < 3) return null;
      const p = pct(f.home.images.filter((i) => i.sized).length, n);
      return { status: grade(p, 80, 40, "higher"), metric: metric(p, "pct", 80, 40, "higher"), vars: { pct: 100 - p } };
    },
  },
  {
    id: "third_parties",
    category: "speed",
    weight: 1,
    effort: "quick",
    run: (f) => ({
      status: grade(f.thirdParties.length, 5, 12, "lower"),
      metric: metric(f.thirdParties.length, "count", 5, 12),
      vars: { n: f.thirdParties.length },
      items: f.thirdParties.slice(0, 20).map((h) => ({ label: h })),
    }),
  },
  {
    id: "cache_static",
    category: "speed",
    weight: 1,
    effort: "dev",
    run: (f) => {
      const own = f.assets.filter((a) => a.firstParty && a.status != null && a.status < 400 && a.cacheSeconds != null);
      if (own.length < 3) return null;
      const p = pct(own.filter((a) => (a.cacheSeconds ?? 0) >= 7 * 86_400).length, own.length);
      return { status: grade(p, 80, 40, "higher"), metric: metric(p, "pct", 80, 40, "higher"), vars: { pct: p } };
    },
  },

  /* ------------------------------- search ------------------------------ */
  {
    id: "indexable",
    category: "search",
    weight: 5,
    effort: "quick",
    run: (f) => ({ status: /noindex/i.test(`${f.home.robotsMeta ?? ""} ${f.headers["x-robots-tag"] ?? ""}`) ? "fail" : "pass" }),
  },
  {
    id: "content_visible",
    category: "search",
    weight: 3,
    effort: "dev",
    run: (f) => ({ status: f.home.textLength < 250 && f.home.scripts.length >= 3 ? "fail" : "pass", vars: { chars: f.home.textLength } }),
  },
  {
    id: "title",
    category: "search",
    weight: 3,
    effort: "quick",
    run: (f) => {
      const t = f.home.title;
      if (!t) return { status: "fail" };
      const len = [...t].length;
      return { status: len < 15 || len > 70 ? "warn" : "pass", vars: { len, text: t, short: len < 15 ? 1 : 0 } };
    },
  },
  {
    id: "meta_description",
    category: "search",
    weight: 3,
    effort: "quick",
    run: (f) => {
      const d = f.home.description;
      if (!d) return { status: "fail" };
      const len = [...d].length;
      return { status: len < 50 || len > 170 ? "warn" : "pass", vars: { len, text: d, short: len < 50 ? 1 : 0 } };
    },
  },
  {
    id: "h1",
    category: "search",
    weight: 1,
    effort: "dev",
    run: (f) => {
      const n = f.home.h1.filter(Boolean).length;
      return { status: n === 1 ? "pass" : n === 0 ? "fail" : "warn", vars: { n }, items: f.home.h1.slice(0, 5).map((h) => ({ label: h || "(empty)" })) };
    },
  },
  {
    id: "img_alt",
    category: "search",
    weight: 2,
    effort: "quick",
    run: (f) => {
      const imgs = f.home.images;
      if (imgs.length < 3) return null;
      const p = pct(imgs.filter((i) => i.alt).length, imgs.length);
      return { status: grade(p, 80, 40, "higher"), metric: metric(p, "pct", 80, 40, "higher"), vars: { pct: p, missing: imgs.filter((i) => !i.alt).length } };
    },
  },
  {
    id: "open_graph",
    category: "search",
    weight: 2,
    effort: "quick",
    run: (f) => {
      const { title, image } = f.home.og;
      return { status: title && image ? "pass" : title || image ? "warn" : "fail", vars: { missing: [!title && "og:title", !image && "og:image"].filter(Boolean).join(", ") } };
    },
  },
  {
    id: "robots_txt",
    category: "search",
    weight: 2,
    effort: "quick",
    run: (f) =>
      f.robots.blocksHome || f.robots.disallowAll
        ? { status: "fail", vars: { what: "home" } }
        : f.robots.blocksProduct
          ? { status: "warn", vars: { what: "product" } }
          : { status: f.robots.found ? "pass" : "warn", vars: { what: "missing" } },
  },
  {
    id: "sitemap",
    category: "search",
    weight: 2,
    effort: "quick",
    run: (f) => ({ status: f.sitemap.ok ? "pass" : "warn", vars: { url: f.sitemap.url ?? "" } }),
  },
  {
    id: "canonical",
    category: "search",
    weight: 1,
    effort: "dev",
    run: (f) => ({ status: f.home.canonical ? "pass" : "warn" }),
  },
  {
    id: "structured_data",
    category: "search",
    weight: 1,
    effort: "dev",
    run: (f) => ({ status: f.home.jsonLdTypes.length ? "pass" : "warn", vars: { types: f.home.jsonLdTypes.slice(0, 4).join(", ") } }),
  },
  {
    id: "product_schema",
    category: "search",
    weight: 3,
    effort: "dev",
    run: (f) => {
      if (!f.product) return null;
      const o = f.product.productOffer;
      return { status: o?.price ? "pass" : o ? "warn" : "fail", vars: { url: f.product.url } };
    },
  },
  {
    id: "hreflang",
    category: "search",
    weight: 1,
    effort: "dev",
    run: (f) => (f.home.langSwitch ? { status: f.home.hreflang.length >= 2 ? "pass" : "warn" } : null),
  },
  {
    id: "favicon",
    category: "search",
    weight: 1,
    effort: "quick",
    run: (f) => ({ status: f.faviconOk ? "pass" : "warn" }),
  },

  /* ------------------------------- trust ------------------------------- */
  {
    id: "https",
    category: "trust",
    weight: 5,
    effort: "quick",
    run: (f) => ({ status: f.https ? "pass" : "fail" }),
  },
  {
    id: "http_redirect",
    category: "trust",
    weight: 2,
    effort: "quick",
    run: (f) => (f.https && f.httpToHttps !== null ? { status: f.httpToHttps ? "pass" : "warn" } : null),
  },
  {
    id: "ssl_expiry",
    category: "trust",
    weight: 3,
    effort: "quick",
    run: (f) => (f.cert ? { status: f.cert.daysLeft < 7 ? "fail" : f.cert.daysLeft < 21 ? "warn" : "pass", vars: { days: f.cert.daysLeft, issuer: f.cert.issuer ?? "" } } : null),
  },
  {
    id: "contact",
    category: "trust",
    weight: 3,
    effort: "quick",
    run: (f) => {
      const c = f.home.contact;
      const ways = [c.tel && "phone", c.mailto && "email", c.whatsapp && "WhatsApp"].filter(Boolean) as string[];
      // Hosted store builders draw their contact buttons with JavaScript, which
      // a check-up reading the HTML can't see. Saying "none" there would be wrong.
      if (!ways.length && scriptDrawn(f)) return null;
      return { status: ways.length ? "pass" : "fail", vars: { ways: ways.join(", ") } };
    },
  },
  {
    id: "whatsapp",
    category: "trust",
    weight: 2,
    effort: "quick",
    run: (f) => (!f.home.contact.whatsapp && scriptDrawn(f) ? null : { status: f.home.contact.whatsapp ? "pass" : "warn" }),
  },
  {
    id: "return_policy",
    category: "trust",
    weight: 3,
    effort: "quick",
    run: (f) => ({ status: f.home.policies.returns || f.product?.policies.returns ? "pass" : "fail", vars: { url: f.home.policies.returns ?? "" } }),
  },
  {
    id: "shipping_info",
    category: "trust",
    weight: 2,
    effort: "quick",
    run: (f) => ({ status: f.home.policies.shipping || f.product?.policies.shipping ? "pass" : "warn" }),
  },
  {
    id: "privacy_policy",
    category: "trust",
    weight: 1,
    effort: "quick",
    run: (f) => ({ status: f.home.policies.privacy ? "pass" : "warn" }),
  },
  {
    id: "payment_methods",
    category: "trust",
    weight: 1,
    effort: "quick",
    run: (f) => {
      const list = [...new Set([...f.home.payments, ...(f.product?.payments ?? [])])];
      return { status: list.length ? "pass" : "warn", vars: { list: list.join(", ") } };
    },
  },
  {
    id: "business_identity",
    category: "trust",
    weight: 1,
    effort: "quick",
    run: (f) => ({ status: f.home.identity.length ? "pass" : "warn", vars: { list: f.home.identity.join(", ") } }),
  },
  {
    id: "social_links",
    category: "trust",
    weight: 1,
    effort: "quick",
    run: (f) => ({ status: f.home.socials.length ? "pass" : "warn", vars: { list: f.home.socials.join(", ") } }),
  },
  {
    id: "broken_links",
    category: "trust",
    weight: 2,
    effort: "quick",
    run: (f) => {
      if (!f.links.checked) return null;
      const n = f.links.broken.length;
      return {
        status: grade(n, 0, 2, "lower"),
        metric: metric(n, "count", 0, 2),
        vars: { n, checked: f.links.checked },
        items: f.links.broken.slice(0, 10).map((b) => ({ label: b.url.replace(/^https?:\/\/[^/]+/, "") || "/", value: b.status == null ? "no answer" : `HTTP ${b.status}`, href: b.url })),
      };
    },
  },
  {
    id: "product_price",
    category: "trust",
    weight: 2,
    effort: "quick",
    run: (f) => (f.product ? { status: f.product.priceVisible ? "pass" : "warn", vars: { url: f.product.url } } : null),
  },
  {
    id: "add_to_cart",
    category: "trust",
    weight: 2,
    effort: "quick",
    run: (f) => (f.product ? { status: f.product.addToCart ? "pass" : "warn", vars: { url: f.product.url } } : null),
  },

  /* --------------------------- mobile & arabic -------------------------- */
  {
    id: "viewport",
    category: "mobile",
    weight: 5,
    effort: "dev",
    run: (f) => ({ status: /width\s*=\s*device-width/i.test(f.home.viewport ?? "") ? "pass" : "fail" }),
  },
  {
    id: "zoom",
    category: "mobile",
    weight: 1,
    effort: "dev",
    run: (f) => {
      const v = f.home.viewport;
      if (!v) return null;
      return { status: /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(v) ? "warn" : "pass" };
    },
  },
  {
    id: "rtl",
    category: "mobile",
    weight: 3,
    effort: "dev",
    run: (f) => (f.home.arabicRatio > 0.3 ? { status: f.home.dir === "rtl" ? "pass" : "fail" } : null),
  },
  {
    id: "lang_attr",
    category: "mobile",
    weight: 1,
    effort: "dev",
    run: (f) => ({ status: f.home.lang ? "pass" : "warn", vars: { lang: f.home.lang ?? "" } }),
  },
  {
    id: "touch_icon",
    category: "mobile",
    weight: 1,
    effort: "quick",
    run: (f) => ({ status: f.home.touchIcon ? "pass" : "warn" }),
  },
  {
    id: "arabic_version",
    category: "mobile",
    weight: 0,
    effort: "medium",
    run: (f) => (f.home.arabicRatio < 0.05 && !f.home.langSwitch ? { status: "info" } : null),
  },

  /* ------------------------------ security ----------------------------- */
  {
    id: "hsts",
    category: "security",
    weight: 2,
    effort: "dev",
    run: (f) => (f.https ? { status: f.headers["strict-transport-security"] ? "pass" : "warn" } : null),
  },
  {
    id: "mixed_content",
    category: "security",
    weight: 3,
    effort: "quick",
    run: (f) =>
      f.https
        ? { status: f.home.mixed.length ? "fail" : "pass", vars: { n: f.home.mixed.length }, items: f.home.mixed.slice(0, 10).map((u) => ({ label: u })) }
        : null,
  },
  {
    id: "nosniff",
    category: "security",
    weight: 1,
    effort: "dev",
    run: (f) => ({ status: /nosniff/i.test(f.headers["x-content-type-options"] ?? "") ? "pass" : "warn" }),
  },
  {
    id: "clickjacking",
    category: "security",
    weight: 1,
    effort: "dev",
    run: (f) => ({ status: f.headers["x-frame-options"] || /frame-ancestors/i.test(f.headers["content-security-policy"] ?? "") ? "pass" : "warn" }),
  },
  {
    id: "referrer",
    category: "security",
    weight: 1,
    effort: "dev",
    run: (f) => ({ status: f.headers["referrer-policy"] ? "pass" : "warn" }),
  },
  {
    id: "server_leak",
    category: "security",
    weight: 1,
    effort: "dev",
    run: (f) => {
      const leak = [f.headers["x-powered-by"], /\/\d/.test(f.headers.server ?? "") ? f.headers.server : null].filter(Boolean).join(", ");
      return { status: leak ? "warn" : "pass", vars: { value: leak } };
    },
  },
];

export const CHECK_IDS = DEFS.map((d) => d.id);
export const CHECKS = DEFS.map((d) => ({ id: d.id, category: d.category, weight: d.weight }));

/** Runs every check against the facts. Checks that don't apply are left out. */
export function evaluate(facts: Facts): Finding[] {
  const out: Finding[] = [];
  for (const d of DEFS) {
    const r = d.run(facts);
    if (!r || r.status === "skip") continue;
    out.push({ id: d.id, category: d.category, weight: d.weight, effort: d.effort, ...r });
  }
  return out;
}

const credit = (s: Status) => (s === "pass" ? 1 : s === "warn" ? 0.5 : 0);

/** 0 to 100 per category (weighted by each check's importance), and overall. */
export function score(findings: Finding[], psiScore?: number | null): Scores {
  const categories: Scores["categories"] = {};
  for (const c of CATEGORIES) {
    const list = findings.filter((f) => f.category === c && f.weight > 0 && (f.status === "pass" || f.status === "warn" || f.status === "fail"));
    const total = list.reduce((s, f) => s + f.weight, 0);
    if (!total) continue;
    let v = (list.reduce((s, f) => s + f.weight * credit(f.status), 0) / total) * 100;
    // Google's own lab score, when we have it, counts for a third of speed.
    if (c === "speed" && psiScore != null) v = v * (2 / 3) + psiScore * (1 / 3);
    categories[c] = Math.round(v);
  }
  const used = CATEGORIES.filter((c) => categories[c] != null);
  const wsum = used.reduce((s, c) => s + CATEGORY_WEIGHTS[c], 0);
  const overall = wsum ? Math.round(used.reduce((s, c) => s + (categories[c] ?? 0) * CATEGORY_WEIGHTS[c], 0) / wsum) : 0;
  return { overall, categories };
}

/** The prescription: what to fix first, by how much each fix is worth. */
export function prescription(findings: Finding[], max = 5): Finding[] {
  const effortRank: Record<Effort, number> = { quick: 0, medium: 1, dev: 2 };
  return findings
    .filter((f) => (f.status === "fail" || f.status === "warn") && f.weight > 0)
    .map((f) => ({ f, impact: f.weight * (f.status === "fail" ? 1 : 0.5) * CATEGORY_WEIGHTS[f.category] * 4 }))
    .sort((a, b) => b.impact - a.impact || effortRank[a.f.effort] - effortRank[b.f.effort])
    .slice(0, max)
    .map((x) => x.f);
}

export type Verdict = "healthy" | "good" | "attention" | "poor";
export const verdictOf = (s: number): Verdict => (s >= 85 ? "healthy" : s >= 70 ? "good" : s >= 50 ? "attention" : "poor");

export type { FindingItem };
