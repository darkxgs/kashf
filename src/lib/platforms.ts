import type { PlatformId } from "./types";

export const PLATFORM_NAMES: Record<PlatformId, { en: string; ar: string }> = {
  shopify: { en: "Shopify", ar: "شوبيفاي" },
  salla: { en: "Salla", ar: "سلة" },
  zid: { en: "Zid", ar: "زد" },
  woocommerce: { en: "WooCommerce", ar: "ووكومرس" },
  wordpress: { en: "WordPress", ar: "ووردبريس" },
  magento: { en: "Magento", ar: "ماجنتو" },
  wix: { en: "Wix", ar: "ويكس" },
  squarespace: { en: "Squarespace", ar: "سكوير سبيس" },
  bigcommerce: { en: "BigCommerce", ar: "بيج كومرس" },
  youcan: { en: "YouCan", ar: "يوكان" },
  expandcart: { en: "ExpandCart", ar: "إكسباند كارت" },
  opencart: { en: "OpenCart", ar: "أوبن كارت" },
  webflow: { en: "Webflow", ar: "ويب فلو" },
  nextjs: { en: "Next.js (custom)", ar: "Next.js (مخصص)" },
};

// Fingerprints in the HTML (asset hosts, theme globals) or response headers.
// Order matters: WooCommerce before WordPress, platforms before frameworks.
const RULES: { id: PlatformId; html?: RegExp; header?: (h: Record<string, string>) => boolean }[] = [
  { id: "shopify", html: /cdn\.shopify\.com|Shopify\.theme|\.myshopify\.com/, header: (h) => "x-shopid" in h || "x-shopify-stage" in h || /shopify/i.test(h["powered-by"] ?? "") },
  { id: "salla", html: /cdn\.salla\.(sa|network)|assets\.salla\.network|salla\.sa\/|window\.salla\b/i },
  { id: "zid", html: /media\.zid\.store|zid\.store\/|zidcdn|window\.zid\b|"zid_/i },
  { id: "youcan", html: /cdn\.youcan\.shop|youcan\.shop\//i },
  { id: "expandcart", html: /expandcart/i },
  { id: "bigcommerce", html: /cdn11\.bigcommerce\.com/i },
  { id: "wix", html: /static\.wixstatic\.com|static\.parastorage\.com/i, header: (h) => "x-wix-request-id" in h },
  { id: "squarespace", html: /static1\.squarespace\.com|squarespace-cdn\.com/i },
  { id: "magento", html: /Magento_|mage\/cookies|static\/version\d+\/frontend/ },
  { id: "woocommerce", html: /wp-content\/plugins\/woocommerce|class="[^"]*woocommerce/i },
  { id: "wordpress", html: /wp-content\/|wp-includes\//i },
  { id: "opencart", html: /catalog\/view\/theme\/|index\.php\?route=product/i },
  { id: "webflow", html: /assets\.website-files\.com|cdn\.prod\.website-files\.com|data-wf-page/i },
  { id: "nextjs", html: /\/_next\/static\// },
];

export function detectPlatform(html: string, headers: Record<string, string>): PlatformId | null {
  for (const r of RULES) {
    if (r.header?.(headers)) return r.id;
    if (r.html?.test(html)) return r.id;
  }
  return null;
}

/** Content delivery hosts that belong to the platform itself: a store owner can't remove them. */
export const PLATFORM_HOSTS = /(^|\.)(shopify\.com|shopifycdn\.com|shopifysvc\.com|salla\.(sa|network)|zid\.store|zidcdn\.com|youcan\.shop|wixstatic\.com|parastorage\.com|squarespace\.com|bigcommerce\.com|website-files\.com|webflow\.com)$/i;
