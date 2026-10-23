// URL helpers shared by the browser (form) and the server (engine).

// Two-level public suffixes common in the region, so "shop.example.com.sa"
// and "example.com.sa" count as one site.
const TWO_LEVEL = /\.(com|net|org|edu|gov|co|ac)\.(sa|eg|ae|kw|qa|bh|om|jo|lb|ma|tn|dz|iq|uk|au|tr|in)$/i;

/** "www.shop.example.com.sa" becomes "example.com.sa". */
export function siteOf(hostname: string): string {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(":")) return h;
  const parts = h.split(".");
  const keep = TWO_LEVEL.test(h) ? 3 : 2;
  return parts.slice(-keep).join(".");
}

export const sameSite = (a: string, b: string) => siteOf(a) === siteOf(b);

/** "example.com/shop" becomes "https://example.com/shop". Null when it can't be a public web address. */
export function normalizeUrl(input: string): string | null {
  let s = input.trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `https://${s}`;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  if (!u.hostname.includes(".") && u.hostname !== "localhost") return null;
  u.hash = "";
  return u.toString();
}

/** How a store's address reads in a heading: no protocol, no www, no trailing slash. */
/** The host (without www) and the path, separately, for headings that show the host large and the path small. */
export function hostAndPath(url: string): { host: string; path: string } {
  try {
    const u = new URL(url);
    return { host: u.host.replace(/^www\./, ""), path: u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "") };
  } catch {
    return { host: url, path: "" };
  }
}

export function displayHost(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "");
    return `${u.host.replace(/^www\./, "")}${path}`;
  } catch {
    return url;
  }
}
