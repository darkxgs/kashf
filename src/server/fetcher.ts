import "server-only";
import tls from "node:tls";
import zlib from "node:zlib";
import { Agent, request } from "undici";
import { assertFetchableUrl, guardedLookup } from "./net-guard";

/**
 * Kashf loads a store the way a phone does, and says who it is: the token at
 * the end lets store owners recognise (or allow) the audit in their logs.
 */
export const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 KashfAudit/1.0 (+https://github.com/darkxgs/kashf)";

const HTML_ACCEPT = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
export const IMAGE_ACCEPT = "image/avif,image/webp,image/apng,image/*,*/*;q=0.8";

/** One connection pool per audit, with every DNS answer checked against private ranges. */
export function makeAgent(allowPrivate: boolean, timeoutMs = 10_000) {
  return new Agent({ connect: { lookup: guardedLookup(allowPrivate) as never, timeout: timeoutMs }, keepAliveTimeout: 4_000, connections: 8 });
}

export type FetchResult = {
  url: string;
  status: number;
  headers: Record<string, string>;
  redirects: { url: string; status: number }[];
  ttfbMs: number;
  totalMs: number;
  transferBytes: number;
  body: Buffer | null;
  encoding: string | null;
  truncated: boolean;
};

export class FetchError extends Error {
  constructor(
    public code: "blocked" | "timeout" | "dns" | "refused" | "tls" | "network",
    message: string,
  ) {
    super(message);
  }
}

function classify(e: unknown): FetchError {
  if (e instanceof FetchError) return e;
  let cur: unknown = e;
  for (let i = 0; i < 5 && cur; i++) {
    const c = (cur as { code?: string }).code;
    const name = (cur as { name?: string }).name;
    if (c === "EBLOCKED") return new FetchError("blocked", "Private address");
    if (name === "AbortError" || c?.includes("TIMEOUT") || c === "ETIMEDOUT") return new FetchError("timeout", "Timed out");
    if (c === "ENOTFOUND" || c === "EAI_AGAIN") return new FetchError("dns", "Domain not found");
    if (c === "ECONNREFUSED") return new FetchError("refused", "Connection refused");
    if (c?.startsWith("ERR_TLS") || c?.includes("CERT")) return new FetchError("tls", "Certificate problem");
    cur = (cur as { cause?: unknown }).cause;
  }
  if ((e as { name?: string })?.name === "BlockedAddressError") return new FetchError("blocked", "Private address");
  return new FetchError("network", (e as Error)?.message ?? "Network error");
}

export function decodeBody(buf: Buffer, encoding: string | null): Buffer {
  const enc = (encoding ?? "").toLowerCase().trim();
  try {
    if (enc === "br") return zlib.brotliDecompressSync(buf, { finishFlush: zlib.constants.BROTLI_OPERATION_FLUSH });
    if (enc === "gzip" || enc === "x-gzip") return zlib.gunzipSync(buf, { finishFlush: zlib.constants.Z_SYNC_FLUSH });
    if (enc === "deflate") {
      try {
        return zlib.inflateSync(buf, { finishFlush: zlib.constants.Z_SYNC_FLUSH });
      } catch {
        return zlib.inflateRawSync(buf, { finishFlush: zlib.constants.Z_SYNC_FLUSH });
      }
    }
  } catch {
    return buf;
  }
  return buf;
}

const headerRecord = (h: Record<string, string | string[] | undefined>) => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) if (v !== undefined) out[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : v;
  return out;
};

/**
 * Fetches a URL, following up to five redirects (each one re-checked against
 * the private-network guard). Measures time to the final response's headers
 * and the bytes on the wire, and decodes gzip or Brotli bodies.
 */
export async function fetchUrl(
  rawUrl: string,
  o: { agent: Agent; allowPrivate: boolean; method?: "GET" | "HEAD"; maxBytes?: number; timeoutMs?: number; follow?: boolean; accept?: string; readBody?: boolean },
): Promise<FetchResult> {
  const timeoutMs = o.timeoutMs ?? 12_000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = performance.now();
  const redirects: FetchResult["redirects"] = [];
  try {
    let url = assertFetchableUrl(rawUrl, o.allowPrivate);
    for (let hop = 0; ; hop++) {
      const res = await request(url, {
        method: o.method ?? "GET",
        dispatcher: o.agent,
        signal: ctrl.signal,
        headers: { "user-agent": USER_AGENT, accept: o.accept ?? HTML_ACCEPT, "accept-encoding": "br, gzip, deflate", "accept-language": "ar,en;q=0.8" },
        headersTimeout: timeoutMs,
        bodyTimeout: timeoutMs,
      });
      const location = res.headers.location;
      if (o.follow !== false && [301, 302, 303, 307, 308].includes(res.statusCode) && location && hop < 5) {
        await res.body.dump();
        redirects.push({ url: url.toString(), status: res.statusCode });
        url = assertFetchableUrl(new URL(String(location), url).toString(), o.allowPrivate);
        continue;
      }
      const ttfbMs = Math.round(performance.now() - started);
      const headers = headerRecord(res.headers);
      let transferBytes = 0;
      let truncated = false;
      let body: Buffer | null = null;
      if (o.readBody === false || o.method === "HEAD") {
        await res.body.dump();
        transferBytes = Number(headers["content-length"] ?? 0) || 0;
      } else {
        const max = o.maxBytes ?? 3_000_000;
        const chunks: Buffer[] = [];
        for await (const chunk of res.body) {
          const b = Buffer.from(chunk as Uint8Array);
          chunks.push(b);
          transferBytes += b.byteLength;
          if (transferBytes >= max) {
            truncated = true;
            break;
          }
        }
        res.body.destroy();
        body = decodeBody(Buffer.concat(chunks), headers["content-encoding"] ?? null);
      }
      return {
        url: url.toString(),
        status: res.statusCode,
        headers,
        redirects,
        ttfbMs,
        totalMs: Math.round(performance.now() - started),
        transferBytes,
        body,
        encoding: headers["content-encoding"] ?? null,
        truncated,
      };
    }
  } catch (e) {
    throw classify(e);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The size of one asset as it travels. HEAD first (cheap); when a server
 * doesn't give a length, read the body up to 8 MB and count.
 */
export async function measureAsset(url: string, o: { agent: Agent; allowPrivate: boolean; accept?: string }) {
  try {
    const head = await fetchUrl(url, { ...o, method: "HEAD", timeoutMs: 8_000 });
    const len = Number(head.headers["content-length"]);
    if (head.status < 400 && Number.isFinite(len) && len > 0) return head;
    const get = await fetchUrl(url, { ...o, method: "GET", timeoutMs: 10_000, maxBytes: 8_000_000 });
    return { ...get, body: null };
  } catch {
    return null;
  }
}

/** The certificate a site presents (even an invalid one), for its expiry date. */
export function readCertificate(rawUrl: string, allowPrivate: boolean, timeoutMs = 8_000): Promise<{ validTo: Date; issuer: string | null } | null> {
  return new Promise((resolve) => {
    let url: URL;
    try {
      url = assertFetchableUrl(rawUrl, allowPrivate);
    } catch {
      return resolve(null);
    }
    if (url.protocol !== "https:") return resolve(null);
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const socket = tls.connect({
      host,
      port: Number(url.port || 443),
      servername: host,
      rejectUnauthorized: false,
      lookup: guardedLookup(allowPrivate) as never,
      timeout: timeoutMs,
    });
    const done = (v: { validTo: Date; issuer: string | null } | null) => {
      socket.destroy();
      resolve(v);
    };
    socket.once("secureConnect", () => {
      const cert = socket.getPeerCertificate();
      if (!cert?.valid_to) return done(null);
      const issuer = (cert.issuer && (cert.issuer.O || cert.issuer.CN)) || null;
      done({ validTo: new Date(cert.valid_to), issuer: Array.isArray(issuer) ? issuer[0] : issuer });
    });
    socket.once("timeout", () => done(null));
    socket.once("error", () => done(null));
  });
}
