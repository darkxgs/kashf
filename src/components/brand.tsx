import { cn } from "./ui";

/** A report slip: three lines of findings, the last one written in pen. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={cn("size-5", className)} aria-hidden>
      <rect x="2.5" y="1.5" width="15" height="17" rx="3.5" fill="currentColor" />
      <rect x="5.5" y="5.5" width="9" height="1.8" rx=".9" fill="#fff" opacity=".55" />
      <rect x="5.5" y="9.2" width="9" height="1.8" rx=".9" fill="#fff" opacity=".55" />
      <rect x="5.5" y="12.9" width="5.5" height="1.8" rx=".9" fill="#7d93ff" />
    </svg>
  );
}

export function Logo({ lang, className }: { lang: "ar" | "en"; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <Mark />
      <span className="text-[19px] leading-none font-semibold tracking-[-0.01em]">{lang === "ar" ? "كشف" : "Kashf"}</span>
    </span>
  );
}
