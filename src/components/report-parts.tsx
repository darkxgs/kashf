"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { arCount } from "@/lib/format";
import type { Lang } from "@/lib/types";
import { buttonClass, cn } from "./ui";

/** Copies the report's address. */
export function CopyLink({ label, done }: { label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass("outline", "sm")}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href.split("#")[0]);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? done : label}
    </button>
  );
}

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" className={buttonClass("outline", "sm")} onClick={() => window.print()}>
      {label}
    </button>
  );
}

type Progress = { status: "running" | "done" | "failed"; steps: { key: string; note?: string }[]; psiStatus: string | null };

/**
 * Follows a running audit: polls its progress, checks off each stage as the
 * server reports it, and swaps in the finished report when it's done.
 */
export function AuditProgress({
  id,
  startedAt,
  initial,
  labels,
  lang,
}: {
  id: string;
  startedAt: string;
  initial: { key: string; note?: string }[];
  labels: { key: string; label: string }[];
  lang: Lang;
}) {
  const router = useRouter();
  const [steps, setSteps] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const done = useRef(false);
  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const r = await fetch(`/api/audits/${id}`, { cache: "no-store" });
        if (r.ok) {
          const p = (await r.json()) as Progress;
          setSteps(p.steps);
          if (p.status !== "running" && !done.current) {
            done.current = true;
            router.refresh();
            return;
          }
        }
      } catch {
        // A dropped request just means we ask again.
      }
      if (!stop) window.setTimeout(poll, 800);
    };
    const t = window.setTimeout(poll, 600);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      stop = true;
      window.clearTimeout(t);
      window.clearInterval(tick);
    };
  }, [id, router]);

  const seen = new Map(steps.map((s) => [s.key, s]));
  const current = labels.findIndex((l) => !seen.has(l.key));
  const secs = Math.max(0, Math.round((now - new Date(startedAt).getTime()) / 1000));
  return (
    <div>
      <ol className="grid gap-1">
        {labels.map((l, i) => {
          const isDone = seen.has(l.key);
          const isNow = i === current;
          const note = noteText(l.key, seen.get(l.key)?.note, lang);
          return (
            <li key={l.key} className={cn("flex items-start gap-3 rounded-card px-3 py-2.5 transition-colors duration-300", isNow && "bg-pen-soft/60")}>
              <span className={cn("mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-full transition-colors duration-300", isDone ? "bg-pass text-white" : isNow ? "text-pen" : "bg-rule-2 text-faint")}>
                {isDone ? (
                  <svg viewBox="0 0 16 16" className="size-3" aria-hidden>
                    <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : isNow ? (
                  <svg viewBox="0 0 22 22" className="size-[22px] animate-spin" aria-hidden>
                    <circle cx="11" cy="11" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.4" />
                    <path d="M20 11a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                  </svg>
                ) : (
                  <span className="size-1.5 rounded-full bg-faint" />
                )}
              </span>
              <span className="min-w-0">
                <span className={cn("block text-[15px]", isDone ? "text-ink" : isNow ? "font-medium text-ink" : "text-muted")}>{l.label}</span>
                {note ? (
                  <span className="block truncate text-[13px] text-muted">
                    <bdi>{note}</bdi>
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 ps-3 text-[13px] text-muted tnum" aria-hidden>
        <bdi dir="ltr">
          {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
        </bdi>
      </p>
    </div>
  );
}

/** The collector reports bare facts (a page title, a file count); this words them. */
function noteText(key: string, note: string | undefined, lang: Lang): string | undefined {
  if (!note) return undefined;
  if (key === "assets" && /^\d+$/.test(note)) {
    const n = Number(note);
    if (lang === "en") return `${n} ${n === 1 ? "file" : "files"} measured`;
    return `قسنا ${arCount(n, { one: "ملفًا واحدًا", two: "ملفين", few: "ملفات", many: "ملفًا" })}`;
  }
  return note;
}

/** While Google's test runs, look for its result every few seconds. */
export function PsiWatcher({ id }: { id: string }) {
  const router = useRouter();
  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const r = await fetch(`/api/audits/${id}`, { cache: "no-store" });
        const p = (await r.json()) as Progress;
        if (p.psiStatus !== "running") {
          router.refresh();
          return;
        }
      } catch {
        // try again
      }
      if (!stop) window.setTimeout(poll, 4000);
    };
    const t = window.setTimeout(poll, 4000);
    return () => {
      stop = true;
      window.clearTimeout(t);
    };
  }, [id, router]);
  return null;
}
