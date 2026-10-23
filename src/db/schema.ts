import { boolean, integer, jsonb, pgSchema, text, timestamp } from "drizzle-orm/pg-core";
import type { Facts, Finding, Psi, Scores, Step } from "@/lib/types";

export const kashf = pgSchema("kashf");
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export type AuditStatus = "running" | "done" | "failed";
export type PsiStatus = "running" | "done" | "failed" | "skipped";

export const audits = kashf.table("audits", {
  id: text("id").primaryKey(),
  url: text("url").notNull(),
  host: text("host").notNull(),
  finalUrl: text("final_url"),
  status: text("status").$type<AuditStatus>().notNull().default("running"),
  error: text("error"),
  errorStatus: integer("error_status"),
  steps: jsonb("steps").$type<Step[]>().notNull().default([]),
  platform: text("platform"),
  score: integer("score"),
  scores: jsonb("scores").$type<Scores["categories"]>(),
  findings: jsonb("findings").$type<Finding[]>(),
  facts: jsonb("facts").$type<Facts>(),
  psi: jsonb("psi").$type<Psi>(),
  psiStatus: text("psi_status").$type<PsiStatus>(),
  ipHash: text("ip_hash"),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
  finishedAt: ts("finished_at"),
});
export type Audit = typeof audits.$inferSelect;
