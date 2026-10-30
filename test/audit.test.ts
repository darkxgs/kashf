import { createServer, type Server } from "node:http";
import { gzipSync } from "node:zlib";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CHECK_IDS, evaluate, grade, prescription, score } from "@/lib/checks";
import { COPY, titleOf } from "@/lib/copy";
import { arCount } from "@/lib/format";
import { detectPlatform } from "@/lib/platforms";
import { normalizeUrl, siteOf } from "@/lib/url";
import { collect, findProductLink, robotsAllows, robotsFacts } from "@/server/collect";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "@/db/migrate";
import { rawQuery } from "@/db/raw";
import { storedKey } from "@/server/keys";
import { parsePage } from "@/server/parse";
import type { Facts, Finding } from "@/lib/types";

/* --------------------------- two fixture stores --------------------------- */

const png = (bytes: number) => Buffer.alloc(bytes, 7);

function goodHome(origin: string) {
  return `<!doctype html><html lang="ar" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>بيت العود | عطور عربية ودهن عود أصلي</title>
<meta name="description" content="متجر بيت العود: عطور عربية ودهن عود أصلي بتوصيل سريع داخل المملكة، ودفع عند الاستلام أو عبر مدى وتابي.">
<link rel="canonical" href="${origin}/">
<meta property="og:title" content="بيت العود"><meta property="og:image" content="${origin}/og.jpg">
<link rel="icon" href="/favicon.ico"><link rel="apple-touch-icon" href="/apple.png">
<link rel="stylesheet" href="/app.css">
<script src="/app.js" defer></script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"OnlineStore","name":"بيت العود"}</script>
</head><body>
<header><a href="https://wa.me/966500000000">واتساب</a> <a href="tel:+966500000000">اتصل بنا</a> <a href="/en">English</a></header>
<h1>عطور عربية أصيلة</h1>
${[1, 2, 3, 4].map((i) => `<img src="/p${i}.webp" alt="عطر عود رقم ${i}" width="400" height="400" loading="lazy">`).join("\n")}
<p>${"عطور فاخرة مصنوعة بعناية من أجود أنواع العود والمسك والعنبر. ".repeat(60)}</p>
<a href="/products/oud-black">عود أسود</a> <a href="/collections/all">كل المنتجات</a>
<footer><a href="/pages/returns">سياسة الاسترجاع والاستبدال</a> <a href="/pages/shipping">الشحن والتوصيل</a> <a href="/pages/privacy">سياسة الخصوصية</a>
<a href="https://instagram.com/baitaloud">Instagram</a> <img src="/mada.webp" alt="mada"> <img src="/applepay.webp" alt="Apple Pay">
<p>الدفع عند الاستلام متاح. السجل التجاري 1010101010 - الرقم الضريبي 300000000000003</p></footer>
</body></html>`;
}

const goodProduct = `<!doctype html><html lang="ar" dir="rtl"><head><title>عود أسود</title>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"عود أسود","offers":{"@type":"Offer","price":"199","priceCurrency":"SAR"}}</script>
</head><body><h1>عود أسود</h1><p>السعر 199 ر.س</p><button>أضف إلى السلة</button></body></html>`;

const badHome = `<!doctype html><html><head>
<meta name="robots" content="noindex">
${[1, 2, 3, 4, 5, 6, 7].map((i) => `<script src="/lib${i}.js"></script>`).join("")}
<script src="https://widgets.example-chat.com/w.js"></script>
</head><body>
<h1>Welcome</h1><h1>Best Deals</h1>
<img src="/hero.png"><img src="/banner.png"><img src="/a.png">
<p>${"Great products at great prices. ".repeat(20)}</p>
<a href="/old-page">Old page</a> <a href="/product/blue-shirt">Blue shirt</a>
</body></html>`;

const badProduct = `<html><head><title>Blue shirt</title></head><body><h1>Blue shirt</h1><p>Lovely shirt.</p></body></html>`;

type Res = { status?: number; type?: string; body: string | Buffer; headers?: Record<string, string> };

function serve(handler: (path: string, origin: string) => Res) {
  return new Promise<{ server: Server; origin: string }>((resolve) => {
    const server = createServer((req, res) => {
      const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const r = handler(req.url ?? "/", origin);
      const gzip = /gzip/.test(String(req.headers["accept-encoding"])) && (r.type ?? "text/html").startsWith("text/");
      const body = gzip ? gzipSync(r.body) : r.body;
      res.writeHead(r.status ?? 200, {
        "content-type": r.type ?? "text/html; charset=utf-8",
        "content-length": String(Buffer.byteLength(body)),
        ...(gzip ? { "content-encoding": "gzip" } : {}),
        ...(r.headers ?? {}),
      });
      res.end(req.method === "HEAD" ? undefined : body);
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}` }));
  });
}

let good: { server: Server; origin: string };
let bad: { server: Server; origin: string };
let goodFacts: Facts;
let badFacts: Facts;
const steps: string[] = [];

beforeAll(async () => {
  good = await serve((path, origin): Res => {
    if (path === "/") return { body: goodHome(origin), headers: { "x-content-type-options": "nosniff", "x-frame-options": "SAMEORIGIN", "referrer-policy": "strict-origin-when-cross-origin" } };
    if (path === "/robots.txt") return { type: "text/plain", body: `User-agent: *\nDisallow: /cart\nSitemap: ${origin}/sitemap.xml\n` };
    if (path === "/sitemap.xml") return { type: "application/xml", body: `<?xml version="1.0"?><urlset><url><loc>${origin}/</loc></url></urlset>` };
    if (path.startsWith("/products/")) return { body: goodProduct };
    if (/\.webp$/.test(path)) return { type: "image/webp", body: png(40_000), headers: { "cache-control": "public, max-age=31536000, immutable" } };
    if (/\.(css|js)$/.test(path)) return { type: path.endsWith(".css") ? "text/css" : "text/javascript", body: "/* ok */".repeat(200), headers: { "cache-control": "public, max-age=31536000" } };
    return { body: "<html><body>ok</body></html>" };
  });
  bad = await serve((path): Res => {
    if (path === "/") return { body: badHome, headers: { "x-powered-by": "PHP/7.2.1" } };
    if (path === "/robots.txt") return { type: "text/plain", body: "User-agent: *\nDisallow: /\n" };
    if (path === "/old-page") return { status: 404, body: "gone" };
    if (path.startsWith("/product/")) return { body: badProduct };
    if (path === "/hero.png") return { type: "image/png", body: png(1_400_000) };
    if (/\.png$/.test(path)) return { type: "image/png", body: png(420_000) };
    if (/\.js$/.test(path)) return { type: "text/javascript", body: "var x=1;".repeat(4000) };
    return { status: 404, body: "not found" };
  });
  goodFacts = await collect(`${good.origin}/`, { allowPrivate: true, onStep: (k) => void steps.push(k) });
  badFacts = await collect(`${bad.origin}/`, { allowPrivate: true });
}, 60_000);

afterAll(() => {
  good?.server.close();
  bad?.server.close();
});

const byId = (fs: Finding[]) => Object.fromEntries(fs.map((f) => [f.id, f]));

describe("collecting facts from a store", () => {
  it("reports progress in order", () => {
    expect(steps).toEqual(["home", "security", "assets", "crawl", "product"]);
  });

  it("reads the home page, its files, robots.txt, the sitemap and a product page", () => {
    expect(goodFacts.encoding).toBe("gzip");
    expect(goodFacts.htmlBytes).toBeGreaterThan(goodFacts.transferBytes);
    expect(goodFacts.home.title).toContain("بيت العود");
    expect(goodFacts.home.contact).toMatchObject({ tel: 1, whatsapp: 1 });
    expect(goodFacts.home.payments).toEqual(expect.arrayContaining(["mada", "Apple Pay", "Cash on delivery"]));
    expect(goodFacts.home.identity).toEqual(expect.arrayContaining(["Commercial registration", "VAT number"]));
    expect(goodFacts.home.langSwitch).toBe(true);
    expect(goodFacts.robots).toMatchObject({ found: true, disallowAll: false, blocksHome: false, blocksProduct: false });
    expect(goodFacts.sitemap.ok).toBe(true);
    expect(goodFacts.assets.filter((a) => a.kind === "image").every((a) => a.type === "image/webp" && a.bytes === 40_000)).toBe(true);
    expect(goodFacts.product?.productOffer).toEqual({ price: "199", currency: "SAR" });
    expect(goodFacts.product?.addToCart).toBe(true);
    expect(badFacts.robots).toMatchObject({ disallowAll: true, blocksHome: true });
    expect(badFacts.links.broken.map((b) => new URL(b.url).pathname)).toEqual(["/old-page"]);
    expect(badFacts.thirdParties).toEqual(["widgets.example-chat.com"]);
  });
});

describe("the check-up", () => {
  it("passes a well-kept store on what matters", () => {
    const f = byId(evaluate(goodFacts));
    for (const id of ["indexable", "title", "meta_description", "viewport", "rtl", "return_policy", "shipping_info", "whatsapp", "contact", "product_schema", "add_to_cart", "product_price", "image_formats", "heavy_images", "compression", "robots_txt", "sitemap", "open_graph", "h1", "img_alt", "broken_links", "payment_methods", "business_identity", "nosniff", "clickjacking"]) {
      expect(f[id]?.status, id).toBe("pass");
    }
    expect(f.https.status).toBe("fail"); // the fixture is plain http
  });

  it("catches what's wrong with a neglected one", () => {
    const f = byId(evaluate(badFacts));
    expect(f.indexable.status).toBe("fail");
    expect(f.robots_txt.status).toBe("fail");
    expect(f.viewport.status).toBe("fail");
    expect(f.title.status).toBe("fail");
    expect(f.h1.status).toBe("warn");
    expect(f.heavy_images).toMatchObject({ status: "fail", vars: { n: 3, max: 1_400_000 } });
    expect(f.render_blocking).toMatchObject({ status: "fail", vars: { n: 8 } });
    expect(f.broken_links).toMatchObject({ status: "warn", vars: { n: 1 } });
    expect(f.img_alt.status).toBe("fail");
    expect(f.product_schema.status).toBe("fail");
    expect(f.server_leak.status).toBe("warn");
    expect(f.rtl).toBeUndefined(); // English page: the RTL check doesn't apply
    expect(f.arabic_version.status).toBe("info");
    expect(score(evaluate(badFacts)).overall).toBeLessThan(score(evaluate(goodFacts)).overall - 25);
  });

  it("doesn't claim a hosted store has no contact buttons it draws by script", () => {
    const none = { ...badFacts.home, contact: { tel: 0, mailto: 0, whatsapp: 0 } };
    expect(byId(evaluate({ ...badFacts, home: none, platform: null })).contact.status).toBe("fail");
    const salla = byId(evaluate({ ...badFacts, home: none, platform: "salla" }));
    expect(salla.contact).toBeUndefined();
    expect(salla.whatsapp).toBeUndefined();
  });

  it("puts the costliest problems first in the prescription", () => {
    const rx = prescription(evaluate(badFacts));
    expect(rx).toHaveLength(5);
    expect(rx[0].id).toBe("indexable");
    expect(rx.every((x) => x.status === "fail" || x.status === "warn")).toBe(true);
  });

  it("has words for every check and result, in both languages", () => {
    for (const id of CHECK_IDS) expect(COPY[id], id).toBeDefined();
    for (const f of [...evaluate(goodFacts), ...evaluate(badFacts)]) {
      for (const lang of ["en", "ar"] as const) {
        const t = titleOf(f, lang);
        expect(t, `${f.id} ${f.status} ${lang}`).not.toBe(f.id);
        expect(t).not.toMatch(/undefined|NaN|\{|\}/);
      }
    }
  });
});

describe("small rules", () => {
  it("grades against thresholds in either direction", () => {
    expect(grade(400, 600, 1500, "lower")).toBe("pass");
    expect(grade(900, 600, 1500, "lower")).toBe("warn");
    expect(grade(2000, 600, 1500, "lower")).toBe("fail");
    expect(grade(85, 80, 40, "higher")).toBe("pass");
    expect(grade(20, 80, 40, "higher")).toBe("fail");
  });

  it("treats a store's subdomains and regional domains as one site", () => {
    expect(siteOf("www.shop.example.com.sa")).toBe("example.com.sa");
    expect(siteOf("cdn.example.com")).toBe("example.com");
    expect(normalizeUrl("example.com/ar")).toBe("https://example.com/ar");
    expect(normalizeUrl("ftp://example.com")).toBeNull();
    expect(normalizeUrl("https://user:pw@example.com")).toBeNull();
  });

  it("recognises store platforms from their fingerprints", () => {
    expect(detectPlatform('<script src="https://cdn.shopify.com/s/files/theme.js">', {})).toBe("shopify");
    expect(detectPlatform('<img src="https://cdn.salla.sa/abc.png">', {})).toBe("salla");
    expect(detectPlatform('<img src="https://media.zid.store/x.jpg">', {})).toBe("zid");
    expect(detectPlatform('<link href="/wp-content/plugins/woocommerce/style.css">', {})).toBe("woocommerce");
    expect(detectPlatform("<p>twilight collection</p>", {})).toBeNull();
  });

  it("finds a product page by the URL shapes stores use", () => {
    const page = parsePage(`<a href="/collections/all">All</a><a href="/ar/oud-oil/p123456">Oud</a>`, "https://s.example.sa/");
    expect(findProductLink(page)).toBe("https://s.example.sa/ar/oud-oil/p123456");
  });

  it("doesn't mistake everyday Arabic words for payment brands", () => {
    const page = parsePage(`<p>توصيل فوري على مدى الأسبوع</p>`, "https://s.example.sa/");
    expect(page.payments).toEqual([]);
  });

  it("counts in Arabic the way Arabic counts", () => {
    const forms = { one: "صورة واحدة", two: "صورتان", few: "صور", many: "صورة" };
    expect([1, 2, 3, 10, 11, 25].map((k) => arCount(k, forms))).toEqual(["صورة واحدة", "صورتان", "3 صور", "10 صور", "11 صورة", "25 صورة"]);
  });
});

describe("robots.txt", () => {
  it("applies the longest matching rule, with Allow winning ties", () => {
    const { rules, sitemaps, disallowAll } = robotsFacts(
      "User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /products/\nAllow: /products/public-\nDisallow: /*.pdf$\nSitemap: https://s.example/sitemap.xml\n",
    );
    expect(sitemaps).toEqual(["https://s.example/sitemap.xml"]);
    expect(disallowAll).toBe(false);
    expect(robotsAllows(rules, "/")).toBe(true);
    expect(robotsAllows(rules, "/products/oud")).toBe(false);
    expect(robotsAllows(rules, "/products/public-oud")).toBe(true);
    expect(robotsAllows(rules, "/files/menu.pdf")).toBe(false);
    expect(robotsAllows(rules, "/files/menu.pdf?x=1")).toBe(true);
  });
});

describe("reading pages", () => {
  it("keeps words in neighbouring elements apart", () => {
    const page = parsePage(`<footer><span>mada</span><span>Apple Pay</span><span>Tabby</span></footer>`, "https://s.example.sa/");
    expect(page.payments).toEqual(["mada", "Apple Pay", "Tabby"]);
  });

  it("only treats real language switches as one", () => {
    expect(parsePage(`<a href="/ar">رجوع</a>`, "https://s.example.sa/shop").langSwitch).toBe(false);
    expect(parsePage(`<a href="/en/shop">EN</a>`, "https://s.example.sa/ar/shop").langSwitch).toBe(true);
    expect(parsePage(`<a href="/en/shop">Store</a>`, "https://s.example.sa/ar/shop").langSwitch).toBe(true);
    expect(parsePage(`<a href="/?lang=ar">العربية</a>`, "https://s.example.sa/").langSwitch).toBe(true);
  });
});

describe("the rate key", () => {
  it("is made once, kept in the database, and found again by every instance", async () => {
    const raw = { kind: "pglite" as const, client: await PGlite.create() };
    await runMigrations(raw);
    const [a, b] = await Promise.all([storedKey(raw, "rate"), storedKey(raw, "rate")]);
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(b).toBe(a);
    expect(await rawQuery<{ name: string; value: string }>(raw, `SELECT name, value FROM kashf.app_keys`)).toEqual([{ name: "rate", value: a }]);
    await raw.client.close();
  });
});
