import type { Lang } from "./types";

// Numbers stay in Latin digits in both languages (as most Gulf and Egyptian
// stores write prices); units are words in Arabic.

export function bytes(n: number, lang: Lang): string {
  if (n >= 1024 * 1024) {
    const v = (n / (1024 * 1024)).toFixed(n >= 10 * 1024 * 1024 ? 0 : 1);
    return lang === "ar" ? `${v} ميغابايت` : `${v} MB`;
  }
  const v = Math.max(1, Math.round(n / 1024));
  return lang === "ar" ? `${v} كيلوبايت` : `${v} KB`;
}

export function ms(n: number, lang: Lang): string {
  if (n < 1000) return lang === "ar" ? `${Math.round(n)} ملّي ثانية` : `${Math.round(n)} ms`;
  const v = Number((n / 1000).toFixed(1));
  return lang === "ar" ? `${v} ثانية` : `${v} s`;
}

export const pct = (n: number) => `${Math.round(n)}%`;

export function count(n: number, lang: Lang, one: [string, string], many: [string, string]): string {
  if (lang === "ar") return `${n} ${n === 1 ? one[1] : many[1]}`;
  return `${n} ${n === 1 ? one[0] : many[0]}`;
}

export function dateTime(iso: string | Date, lang: Lang): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(d);
}

export function dateOnly(iso: string | Date, lang: Lang): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(d);
}

/** Arabic number agreement: 1 and 2 have their own words, 3 to 10 take the plural, 11 and up the singular. */
export function arCount(n: number, forms: { one: string; two: string; few: string; many: string }): string {
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  if (n >= 3 && n <= 10) return `${n} ${forms.few}`;
  return `${n} ${forms.many}`;
}
