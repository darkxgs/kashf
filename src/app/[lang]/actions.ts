"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getConnection } from "@/db";
import { allowPrivateTargets, appUrl } from "@/lib/app-url";
import { isLang } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import { normalizeUrl } from "@/lib/url";
import { createAudit, hashIp, runAudit } from "@/server/audits";
import { assertFetchableUrl } from "@/server/net-guard";

export type StartState = { error?: "invalid" | "private" | "limited"; value?: string } | null;

/** Google's speed test runs on Vercel by default; set KASHF_PSI=0 to skip it, or 1 to run it locally. */
const psiOn = () => process.env.KASHF_PSI === "1" || (!!process.env.VERCEL && process.env.KASHF_PSI !== "0");

async function start(raw: string, lang: Lang, fresh: boolean): Promise<StartState> {
  const url = normalizeUrl(raw);
  if (!url) return { error: "invalid", value: raw };
  try {
    assertFetchableUrl(url, allowPrivateTargets());
  } catch {
    return { error: "private", value: raw };
  }
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const conn = await getConnection();
  const r = await createAudit(conn, { url, ipHash: await hashIp(ip), isDemo: url.startsWith(`${appUrl()}/demo-store`), fresh });
  if (!r.ok) return { error: "limited", value: raw };
  if (!r.reused) {
    after(async () => {
      try {
        await runAudit(conn, r.id, { allowPrivate: allowPrivateTargets(), psi: psiOn() });
      } catch (e) {
        console.error("[audit]", r.id, e);
      }
    });
  }
  redirect(`/${lang}/r/${r.id}`);
}

export async function startAudit(_: StartState, form: FormData): Promise<StartState> {
  const lang = isLang(form.get("lang")) ? (form.get("lang") as Lang) : "en";
  return start(String(form.get("url") ?? "").slice(0, 500), lang, false);
}

/** "Check again" on a report, and the demo store button: always a fresh run unless one just started. */
export async function checkUrl(form: FormData) {
  const lang = isLang(form.get("lang")) ? (form.get("lang") as Lang) : "en";
  const r = await start(String(form.get("url") ?? "").slice(0, 500), lang, form.get("fresh") === "1");
  if (r?.error) redirect(`/${lang}?error=${r.error}#check`);
}
