import "server-only";
import { createHmac } from "node:crypto";
import { and, count, desc, eq, gt, lt, ne } from "drizzle-orm";
import type { Connection } from "@/db";
import { rawQuery } from "@/db/raw";
import { audits, type Audit } from "@/db/schema";
import { evaluate, grade, score } from "@/lib/checks";
import { newId } from "@/lib/id";
import type { Facts, Finding, Psi, Step, StepKey } from "@/lib/types";
import { AuditError, collect } from "./collect";
import { appKey } from "./keys";
import { runPsi } from "./psi";

export const RATE_PER_HOUR = 12;

export const hostKey = (url: string) => new URL(url).hostname.toLowerCase().replace(/^www\./, "");

/** Visitors are rate-limited by a keyed hash of their IP; the address itself is never stored. */
export const hashIp = async (ip: string) => createHmac("sha256", await appKey("rate")).update(ip).digest("hex").slice(0, 32);

export type StartResult = { ok: true; id: string; reused: boolean } | { ok: false; error: "rate_limited" };

/**
 * Creates an audit row. The same address asked for again within two minutes
 * gets the report that's already there (or running) instead of a new run.
 */
export async function createAudit(conn: Connection, input: { url: string; ipHash: string | null; isDemo?: boolean; fresh?: boolean }): Promise<StartResult> {
  const { db } = conn;
  const since = new Date(Date.now() - 2 * 60_000);
  if (!input.fresh) {
    const [recent] = await db
      .select({ id: audits.id })
      .from(audits)
      .where(and(eq(audits.url, input.url), gt(audits.createdAt, since), ne(audits.status, "failed")))
      .orderBy(desc(audits.createdAt))
      .limit(1);
    if (recent) return { ok: true, id: recent.id, reused: true };
  }
  if (input.ipHash) {
    const [{ n }] = await db
      .select({ n: count() })
      .from(audits)
      .where(and(eq(audits.ipHash, input.ipHash), gt(audits.createdAt, new Date(Date.now() - 3_600_000))));
    if (Number(n) >= RATE_PER_HOUR) return { ok: false, error: "rate_limited" };
  }
  const id = newId("r");
  await db.insert(audits).values({ id, url: input.url, host: hostKey(input.url), ipHash: input.ipHash, isDemo: !!input.isDemo });
  return { ok: true, id, reused: false };
}

async function addStep(conn: Connection, id: string, key: StepKey, note?: string) {
  const step: Step = { key, at: new Date().toISOString(), ...(note ? { note: note.slice(0, 120) } : {}) };
  await rawQuery(conn.raw, `UPDATE kashf.audits SET steps = steps || $2::jsonb WHERE id = $1`, [id, JSON.stringify([step])]);
}

export function psiFinding(psi: Psi): Finding | null {
  if (psi.score == null) return null;
  return { id: "psi", category: "speed", status: grade(psi.score, 90, 50, "higher"), weight: 0, effort: "medium", metric: { value: psi.score, unit: "score", good: 90, poor: 50, better: "higher" } };
}

/** Runs the whole audit for a row created by createAudit, then (optionally) Google's speed test. */
export async function runAudit(conn: Connection, id: string, opts: { allowPrivate: boolean; psi: boolean }) {
  const [row] = await conn.db.select().from(audits).where(eq(audits.id, id));
  if (!row || row.status !== "running" || row.facts) return;
  let facts: Facts;
  try {
    facts = await collect(row.url, { allowPrivate: opts.allowPrivate, onStep: (k, note) => addStep(conn, id, k, note) });
  } catch (e) {
    const err = e instanceof AuditError ? e : new AuditError("network");
    if (!(e instanceof AuditError)) console.error("[audit]", e);
    await conn.db.update(audits).set({ status: "failed", error: err.code, errorStatus: err.status ?? null, finishedAt: new Date() }).where(eq(audits.id, id));
    return;
  }
  const findings = evaluate(facts);
  const s = score(findings);
  await addStep(conn, id, "score");
  await conn.db
    .update(audits)
    .set({
      status: "done",
      facts,
      findings,
      scores: s.categories,
      score: s.overall,
      platform: facts.platform,
      finalUrl: facts.finalUrl,
      finishedAt: new Date(),
      psiStatus: opts.psi ? "running" : "skipped",
    })
    .where(eq(audits.id, id));

  if (!opts.psi) return;
  const psi = await runPsi(facts.finalUrl);
  if (!psi || psi.score == null) {
    await conn.db.update(audits).set({ psiStatus: "failed" }).where(eq(audits.id, id));
    return;
  }
  const extra = psiFinding(psi);
  const all = extra ? [...findings, extra] : findings;
  const rescored = score(all, psi.score);
  await conn.db.update(audits).set({ psi, psiStatus: "done", findings: all, scores: rescored.categories, score: rescored.overall }).where(eq(audits.id, id));
}

export async function getAudit(conn: Connection, id: string): Promise<Audit | null> {
  const [row] = await conn.db.select().from(audits).where(eq(audits.id, id)).limit(1);
  return row ?? null;
}

/** Earlier finished reports for the same store, newest first, for the follow-up chart. */
export async function earlierAudits(conn: Connection, host: string, before: Date, limit = 8) {
  return conn.db
    .select({ id: audits.id, score: audits.score, scores: audits.scores, createdAt: audits.createdAt })
    .from(audits)
    .where(and(eq(audits.host, host), eq(audits.status, "done"), lt(audits.createdAt, before)))
    .orderBy(desc(audits.createdAt))
    .limit(limit);
}

/** The newest finished audit of the demo store, for the landing page's sample. */
export async function latestDemoAudit(conn: Connection) {
  const [row] = await conn.db
    .select()
    .from(audits)
    .where(and(eq(audits.isDemo, true), eq(audits.status, "done")))
    .orderBy(desc(audits.createdAt))
    .limit(1);
  return row ?? null;
}

/** Marks audits stuck in "running" (a crashed function) as failed so their pages stop waiting. */
export async function expireStuck(conn: Connection) {
  await conn.db
    .update(audits)
    .set({ status: "failed", error: "timeout", finishedAt: new Date() })
    .where(and(eq(audits.status, "running"), lt(audits.createdAt, new Date(Date.now() - 3 * 60_000))));
  await conn.db
    .update(audits)
    .set({ psiStatus: "failed" })
    .where(and(eq(audits.psiStatus, "running"), lt(audits.createdAt, new Date(Date.now() - 4 * 60_000))));
}

/** True when a date is more than `ms` in the past (kept out of components, which must render purely). */
export const olderThan = (d: Date, ms: number) => Date.now() - d.getTime() > ms;
