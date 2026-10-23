import "server-only";
import { load, type CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import type { ImageFact, LinkFact, PageFacts, ScriptFact } from "@/lib/types";
import { sameSite } from "@/lib/url";

const RETURNS = /\b(returns?|refunds?|exchanges?)\b|استرجاع|استرداد|إرجاع|ارجاع|الاستبدال|استبدال/i;
const SHIPPING = /\b(shipping|delivery)\b|الشحن|شحن|التوصيل|توصيل/i;
const PRIVACY = /\bprivacy\b|الخصوصية|خصوصية/i;
const TERMS = /\b(terms|conditions)\b|الشروط|الأحكام|الاحكام/i;

// Latin names only for words that are also everyday Arabic (مدى "range", فوري "instant").
const PAYMENTS: [string, RegExp][] = [
  ["mada", /\bmada\b/i],
  ["Apple Pay", /apple[\s_-]?pay/i],
  ["STC Pay", /stc[\s_-]?pay/i],
  ["Tabby", /\btabby\b|تابي/i],
  ["Tamara", /\btamara\b|تمارا/i],
  ["Visa", /\bvisa\b|فيزا/i],
  ["Mastercard", /master[\s_-]?card|ماستر\s?كارد/i],
  ["PayPal", /paypal/i],
  ["valU", /\bvalu\b|فاليو/i],
  ["Fawry", /\bfawry\b/i],
  ["InstaPay", /instapay|انستا\s?باي/i],
  ["Google Pay", /google[\s_-]?pay|\bgpay\b/i],
  ["Cash on delivery", /cash on delivery|الدفع عند الاستلام|الدفع عند التوصيل|الدفع عند الإستلام/i],
];

const IDENTITY: [string, RegExp][] = [
  ["Commercial registration", /commercial registration|\bC\.?R\.?\s?(no|number|#)|السجل التجاري|سجل تجاري|رقم السجل/i],
  ["VAT number", /\bVAT\s?(no|number|reg|registration|#)|tax (registration )?number|الرقم الضريبي|رقم ضريبي|الرقم الضريبى|\b3\d{13}3\b/i],
  ["Maroof", /maroof\.sa|منصة معروف/i],
  ["Saudi Business Center", /\bbusiness\.sa\b|المركز السعودي للأعمال/i],
];

const SOCIAL: [string, RegExp][] = [
  ["Instagram", /(^|\.)instagram\.com$/i],
  ["TikTok", /(^|\.)tiktok\.com$/i],
  ["Snapchat", /(^|\.)snapchat\.com$/i],
  ["X", /(^|\.)(x|twitter)\.com$/i],
  ["Facebook", /(^|\.)(facebook|fb)\.com$/i],
  ["YouTube", /(^|\.)youtube\.com$/i],
  ["LinkedIn", /(^|\.)linkedin\.com$/i],
  ["Pinterest", /(^|\.)pinterest\.[a-z.]+$/i],
];

const TOOLS: [string, RegExp][] = [
  ["Google Analytics", /googletagmanager\.com\/gtag\/js|google-analytics\.com\/(analytics|ga)\.js|gtag\(\s*['"]config['"]\s*,\s*['"]G-/],
  ["Google Tag Manager", /googletagmanager\.com\/gtm\.js|['"]GTM-[A-Z0-9]{4,}['"]/],
  ["Google Ads", /googleadservices\.com|['"]AW-\d{6,}['"]/],
  ["Meta Pixel", /connect\.facebook\.net\/[^"']*fbevents\.js|fbq\(\s*['"]init/],
  ["TikTok Pixel", /analytics\.tiktok\.com|ttq\.load\(/],
  ["Snap Pixel", /sc-static\.net\/scevent|snaptr\(\s*['"]init/],
  ["X Pixel", /static\.ads-twitter\.com|twq\(\s*['"]init/],
  ["Microsoft Clarity", /clarity\.ms\/tag/],
  ["Hotjar", /static\.hotjar\.com/],
  ["Tawk.to chat", /embed\.tawk\.to/],
  ["Intercom", /widget\.intercom\.io|js\.intercomcdn\.com/],
  ["Crisp chat", /client\.crisp\.chat/],
  ["Zendesk", /static\.zdassets\.com/],
];

const WHATSAPP = /(^|\/\/)(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com|chat\.whatsapp\.com)|^whatsapp:/i;
const PRICE = /(\d[\d,.٫٬]*\s?(ر\.?\s?س|ريال|SAR|SR\b|EGP|ج\.?\s?م|جنيه|AED|درهم|د\.?\s?إ|KWD|د\.?\s?ك|دينار|QAR|ر\.?\s?ق|BHD|د\.?\s?ب|OMR|ر\.?\s?ع|USD|\$|€|£))|((SAR|SR|EGP|AED|KWD|QAR|BHD|OMR|USD|LE|\$|€|£)\s?\d)/i;
const ADD_TO_CART = /add to (cart|bag|basket)|buy (it )?now|أضف (إلى|الى|لل|ل)?\s?(السلة|سلة|العربة)|اضف (إلى|الى|لل|ل)?\s?(السلة|سلة)|إضافة (إلى|الى|لل|ل)?\s?(السلة|سلة)|اضافة (إلى|الى|لل|ل)?\s?(السلة|سلة)|اشتر(ي)? الآن|اشتري الان|شراء الآن/i;

const abs = (raw: string | undefined | null, base: string): string | null => {
  if (!raw) return null;
  const v = raw.trim();
  if (!v || v.startsWith("data:") || v.startsWith("javascript:") || v.startsWith("blob:")) return null;
  try {
    return new URL(v, base).toString();
  } catch {
    return null;
  }
};

const firstCandidate = (srcset: string | undefined) => srcset?.split(",")[0]?.trim().split(/\s+/)[0];

function jsonLd($: CheerioAPI) {
  const types = new Set<string>();
  let offer = null as PageFacts["productOffer"];
  const walk = (node: unknown, depth = 0) => {
    if (!node || typeof node !== "object" || depth > 8) return;
    if (Array.isArray(node)) {
      node.forEach((n) => walk(n, depth + 1));
      return;
    }
    const o = node as Record<string, unknown>;
    const t = o["@type"];
    const list = Array.isArray(t) ? t : t ? [t] : [];
    for (const x of list) if (typeof x === "string") types.add(x);
    if (list.includes("Product") && o.offers) {
      const offers = Array.isArray(o.offers) ? o.offers[0] : o.offers;
      if (offers && typeof offers === "object") {
        const of = offers as Record<string, unknown>;
        const price = of.price ?? of.lowPrice;
        offer = { price: price == null ? null : String(price), currency: of.priceCurrency ? String(of.priceCurrency) : null };
      } else offer ??= { price: null, currency: null };
    } else if (list.includes("Product")) offer ??= { price: null, currency: null };
    for (const [k, v] of Object.entries(o)) if (k !== "@context" && typeof v === "object") walk(v, depth + 1);
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text().replace(/^\s*<!--|-->\s*$/g, "").trim();
    try {
      walk(JSON.parse(raw));
    } catch {
      // Malformed JSON-LD is common; Google ignores it too.
    }
  });
  return { types: [...types].slice(0, 20), offer };
}

/** Reads the facts a check-up needs from one HTML page. */
export function parsePage(html: string, pageUrl: string): PageFacts {
  const $ = load(html);
  const page = new URL(pageUrl);
  const head = $("head");
  const meta = (sel: string) => $(sel).first().attr("content")?.trim() || null;

  const images: ImageFact[] = [];
  const seenImg = new Set<string>();
  $("img").each((_, el) => {
    const e = $(el);
    if (e.attr("width") === "1" && e.attr("height") === "1") return;
    const src = abs(e.attr("src") || e.attr("data-src") || firstCandidate(e.attr("srcset")) || firstCandidate(e.attr("data-srcset")), pageUrl);
    if (!src || seenImg.has(src) || /facebook\.com\/tr|google-analytics|doubleclick/.test(src)) return;
    seenImg.add(src);
    const alt = e.attr("alt");
    images.push({
      src,
      alt: alt === undefined ? null : alt.trim(),
      sized: !!(e.attr("width") && e.attr("height")),
      lazy: e.attr("loading") === "lazy" || e.attr("data-src") !== undefined || e.attr("data-srcset") !== undefined || /\blazy/.test(e.attr("class") ?? ""),
    });
  });

  const scripts: ScriptFact[] = [];
  $("script[src]").each((_, el) => {
    const e = $(el);
    const src = abs(e.attr("src"), pageUrl);
    if (!src) return;
    const type = (e.attr("type") ?? "").toLowerCase();
    const isJs = !type || type === "text/javascript" || type === "application/javascript" || type === "module";
    const inHead = e.closest("head").length > 0;
    scripts.push({
      src,
      host: new URL(src).hostname,
      inHead,
      blocking: inHead && isJs && type !== "module" && e.attr("async") === undefined && e.attr("defer") === undefined,
    });
  });

  const styles = $('link[rel~="stylesheet"][href]')
    .map((_, el) => abs($(el).attr("href"), pageUrl))
    .get()
    .filter((x): x is string => !!x);
  const fonts = $('link[rel="preload"][as="font"][href]')
    .map((_, el) => abs($(el).attr("href"), pageUrl))
    .get()
    .filter((x): x is string => !!x);

  const links: LinkFact[] = [];
  const contact = { tel: 0, mailto: 0, whatsapp: 0 };
  const socials = new Set<string>();
  const policies: PageFacts["policies"] = { returns: null, shipping: null, privacy: null, terms: null };
  let langSwitch = $('link[rel="alternate"][hreflang]').length > 0;
  $("a[href]").each((_, el) => {
    const e = $(el);
    const raw = (e.attr("href") ?? "").trim();
    const text = e.text().replace(/\s+/g, " ").trim().slice(0, 80);
    if (/^tel:/i.test(raw)) return void contact.tel++;
    if (/^mailto:/i.test(raw)) return void contact.mailto++;
    if (WHATSAPP.test(raw)) return void contact.whatsapp++;
    const href = abs(raw, pageUrl);
    if (!href || raw.startsWith("#")) return;
    const u = new URL(href);
    if (WHATSAPP.test(`//${u.host}`)) return void contact.whatsapp++;
    for (const [name, re] of SOCIAL) if (re.test(u.hostname)) socials.add(name);
    const internal = sameSite(u.hostname, page.hostname);
    const hay = `${text} ${decodeURIComponent(u.pathname).replace(/[-_/]/g, " ")}`;
    if (internal) {
      if (!policies.returns && RETURNS.test(hay)) policies.returns = href;
      if (!policies.shipping && SHIPPING.test(hay)) policies.shipping = href;
      if (!policies.privacy && PRIVACY.test(hay)) policies.privacy = href;
      if (!policies.terms && TERMS.test(hay)) policies.terms = href;
    }
    // A language switch: a link labelled with the other language, or (on a site
    // whose own address starts with /ar or /en) a link to the other prefix.
    const ownPrefix = page.pathname.match(/^\/(ar|en)(\/|$)/)?.[1];
    const linkPrefix = u.pathname.match(/^\/(ar|en)(\/|$)/)?.[1];
    if (/^(العربية|عربي|english|en|ar)$/i.test(text) || (internal && ownPrefix && linkPrefix && ownPrefix !== linkPrefix)) langSwitch = true;
    if (links.length < 500) links.push({ href, text, internal });
  });
  if ($('iframe[src*="whatsapp"], script[src*="whatsapp"], [class*="whatsapp"] a, a[class*="whatsapp"]').length) contact.whatsapp++;

  const mixed: string[] = [];
  if (page.protocol === "https:") {
    $("img[src], script[src], link[rel~='stylesheet'][href], iframe[src], source[src], video[src], audio[src]").each((_, el) => {
      const v = $(el).attr("src") ?? $(el).attr("href") ?? "";
      if (/^http:\/\//i.test(v.trim()) && mixed.length < 20) mixed.push(v.trim());
    });
  }

  const { types, offer } = jsonLd($);
  const tools = TOOLS.filter(([, re]) => re.test(html)).map(([n]) => n);

  // Visible text, for language and "is there content without JavaScript".
  // Joined with spaces between elements, so "mada" and "Apple Pay" in two
  // neighbouring badges don't run together into "madaApple Pay".
  const parts: string[] = [];
  const SKIP = new Set(["script", "style", "noscript", "template", "svg", "head"]);
  const walk = (nodes: AnyNode[]) => {
    for (const node of nodes) {
      if (parts.length > 40_000) return;
      if (node.type === "text") parts.push((node as unknown as { data: string }).data);
      else if ("children" in node && !SKIP.has((node as unknown as { name?: string }).name ?? "")) walk(node.children as AnyNode[]);
    }
  };
  walk($("body").get());
  const text = parts.join(" ").replace(/\s+/g, " ").trim();
  const arabic = (text.match(/[؀-ۿ]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;

  const attrHay = $("img[alt], img[src], [class*='pay'], [class*='payment'], [aria-label]")
    .map((_, el) => `${$(el).attr("alt") ?? ""} ${$(el).attr("src") ?? ""} ${$(el).attr("class") ?? ""} ${$(el).attr("aria-label") ?? ""}`)
    .get()
    .join(" ");
  const hay = `${text.slice(0, 200_000)} ${attrHay.slice(0, 100_000)}`;

  const cartish =
    $("form[action*='/cart/add'], [name='add-to-cart'], [id*='add-to-cart'], [class*='add-to-cart'], [class*='addtocart'], [class*='add_to_cart']").length > 0 ||
    $("button, input[type='submit'], a, [role='button']")
      .map((_, el) => $(el).text() || $(el).attr("value") || "")
      .get()
      .some((t) => ADD_TO_CART.test(t));

  return {
    url: pageUrl,
    lang: $("html").attr("lang")?.trim() || null,
    dir: ($("html").attr("dir") || $("body").attr("dir") || null)?.toLowerCase() ?? null,
    title: $("title").first().text().replace(/\s+/g, " ").trim() || null,
    description: meta('meta[name="description" i]'),
    canonical: abs($('link[rel="canonical"]').attr("href"), pageUrl),
    robotsMeta: meta('meta[name="robots" i]'),
    viewport: meta('meta[name="viewport" i]'),
    h1: $("h1")
      .map((_, el) => $(el).text().replace(/\s+/g, " ").trim().slice(0, 120))
      .get(),
    og: { title: meta('meta[property="og:title"]'), description: meta('meta[property="og:description"]'), image: meta('meta[property="og:image"]') },
    hreflang: $('link[rel="alternate"][hreflang]')
      .map((_, el) => $(el).attr("hreflang") ?? "")
      .get()
      .filter(Boolean),
    icon: abs(head.find('link[rel~="icon"]').first().attr("href"), pageUrl),
    touchIcon: abs(head.find('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]').first().attr("href"), pageUrl),
    jsonLdTypes: types,
    productOffer: offer,
    textLength: text.length,
    arabicRatio: arabic + latin ? arabic / (arabic + latin) : 0,
    images,
    scripts,
    styles,
    fonts,
    links,
    contact,
    socials: [...socials],
    policies,
    payments: PAYMENTS.filter(([, re]) => re.test(hay)).map(([n]) => n),
    identity: IDENTITY.filter(([, re]) => re.test(hay)).map(([n]) => n),
    mixed,
    tools,
    langSwitch,
    priceVisible: PRICE.test(text) || !!offer?.price,
    addToCart: cartish,
  };
}
