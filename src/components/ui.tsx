import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ReactNode } from "react";
import type { Status } from "@/lib/types";

export const cn = (...v: ClassValue[]) => twMerge(clsx(v));

type Variant = "pen" | "ink" | "outline" | "ghost";
const VARIANTS: Record<Variant, string> = {
  pen: "bg-pen text-white hover:bg-pen-deep",
  ink: "bg-ink text-white hover:bg-ink-2",
  outline: "border border-rule bg-paper text-ink hover:border-ink-2/40",
  ghost: "text-ink-2 hover:bg-rule-2 hover:text-ink",
};
const SIZES = { sm: "h-9 px-3.5 text-[14px]", md: "h-11 px-5 text-[15px]", lg: "h-[52px] px-6 text-[16px]" } as const;

export function buttonClass(variant: Variant = "pen", size: keyof typeof SIZES = "md", extra?: string) {
  return cn(
    "inline-flex select-none items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    extra,
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("size-4 animate-spin", className)} aria-hidden>
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export const STATUS_STYLE: Record<Status, { text: string; soft: string; solid: string }> = {
  pass: { text: "text-pass", soft: "bg-pass-soft", solid: "bg-pass" },
  warn: { text: "text-warn", soft: "bg-warn-soft", solid: "bg-warn" },
  fail: { text: "text-fail", soft: "bg-fail-soft", solid: "bg-fail" },
  info: { text: "text-muted", soft: "bg-rule-2", solid: "bg-faint" },
  skip: { text: "text-faint", soft: "bg-rule-2", solid: "bg-faint" },
};

/** The result mark: a tick, a bar or a cross in a small tinted disc, with its meaning for screen readers. */
export function StatusMark({ status, label, className }: { status: Status; label: string; className?: string }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={cn("grid size-[22px] shrink-0 place-items-center rounded-full", s.soft, s.text, className)}>
      <svg viewBox="0 0 16 16" className="size-3" aria-hidden>
        {status === "pass" ? (
          <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        ) : status === "fail" ? (
          <path d="M4.5 4.5l7 7m0-7l-7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        ) : status === "warn" ? (
          <path d="M8 3.5v5.5M8 12.2v.3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        ) : (
          <path d="M8 7.5v5M8 4.2v.3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        )}
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex h-6 items-center rounded-full bg-rule-2 px-2.5 text-[12.5px] font-medium text-ink-2", className)}>{children}</span>;
}
