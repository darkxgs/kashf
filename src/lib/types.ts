// Shapes shared by the audit engine (server), the checks (pure) and the report (UI).

export type Lang = "ar" | "en";
export type Category = "speed" | "search" | "trust" | "mobile" | "security";
export type Status = "pass" | "warn" | "fail" | "info" | "skip";
export type Effort = "quick" | "medium" | "dev";

export type PlatformId =
  | "shopify"
  | "salla"
  | "zid"
  | "woocommerce"
  | "wordpress"
  | "magento"
  | "wix"
  | "squarespace"
  | "bigcommerce"
  | "youcan"
  | "expandcart"
  | "opencart"
  | "webflow"
  | "nextjs";

export type ImageFact = { src: string; alt: string | null; sized: boolean; lazy: boolean };
export type ScriptFact = { src: string | null; host: string | null; inHead: boolean; blocking: boolean };
export type LinkFact = { href: string; text: string; internal: boolean };

/** What we read from one HTML page. */
export type PageFacts = {
  url: string;
  lang: string | null;
  dir: string | null;
  title: string | null;
  description: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  viewport: string | null;
  h1: string[];
  og: { title: string | null; description: string | null; image: string | null };
  hreflang: string[];
  icon: string | null;
  touchIcon: string | null;
  jsonLdTypes: string[];
  productOffer: { price: string | null; currency: string | null } | null;
  textLength: number;
  arabicRatio: number;
  images: ImageFact[];
  scripts: ScriptFact[];
  styles: string[];
  fonts: string[];
  links: LinkFact[];
  contact: { tel: number; mailto: number; whatsapp: number };
  socials: string[];
  policies: { returns: string | null; shipping: string | null; privacy: string | null; terms: string | null };
  payments: string[];
  identity: string[];
  mixed: string[];
  tools: string[];
  langSwitch: boolean;
  priceVisible: boolean;
  addToCart: boolean;
};

export type AssetFact = {
  url: string;
  kind: "image" | "script" | "style" | "font";
  bytes: number | null;
  type: string | null;
  cacheSeconds: number | null;
  firstParty: boolean;
  status: number | null;
};

export type Psi = {
  score: number | null;
  lcpMs: number | null;
  tbtMs: number | null;
  cls: number | null;
  fcpMs: number | null;
  field: { lcpMs: number | null; inpMs: number | null; cls: number | null; category: string | null } | null;
};

/** Everything measured in one audit. Stored as JSON so the report can be re-rendered (and re-scored) later. */
export type Facts = {
  requestedUrl: string;
  finalUrl: string;
  redirects: { url: string; status: number }[];
  status: number;
  ttfbMs: number;
  totalMs: number;
  headers: Record<string, string>;
  encoding: string | null;
  htmlBytes: number;
  transferBytes: number;
  https: boolean;
  httpToHttps: boolean | null;
  cert: { validTo: string; issuer: string | null; daysLeft: number } | null;
  platform: PlatformId | null;
  home: PageFacts;
  assets: AssetFact[];
  robots: { found: boolean; disallowAll: boolean; blocksHome: boolean; blocksProduct: boolean; sitemaps: string[] };
  sitemap: { url: string | null; ok: boolean };
  faviconOk: boolean;
  links: { checked: number; broken: { url: string; status: number | null }[] };
  product: PageFacts | null;
  thirdParties: string[];
};

export type Metric = {
  value: number;
  unit: "ms" | "bytes" | "count" | "pct" | "score";
  good: number;
  poor: number;
  better: "lower" | "higher";
};

export type FindingItem = { label: string; value?: string; href?: string };

export type Finding = {
  id: string;
  category: Category;
  status: Status;
  weight: number;
  effort: Effort;
  metric?: Metric;
  vars?: Record<string, string | number>;
  items?: FindingItem[];
};

export type Scores = { overall: number; categories: Partial<Record<Category, number>> };

export type StepKey = "home" | "security" | "assets" | "crawl" | "product" | "score";
export type Step = { key: StepKey; at: string; note?: string };
