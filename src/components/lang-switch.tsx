"use client";

import Link from "next/link";
import { cn } from "./ui";

/** Switches language and remembers the choice for the next visit to the home page. */
export function LangSwitch({ to, href, label, className }: { to: "ar" | "en"; href: string; label: string; className?: string }) {
  return (
    <Link
      href={href}
      hrefLang={to}
      lang={to}
      onClick={() => {
        document.cookie = `kashf_lang=${to}; path=/; max-age=31536000; samesite=lax`;
      }}
      className={cn("rounded-control px-3 py-1.5 text-[14px] text-ink-2 transition-colors hover:bg-rule-2 hover:text-ink", className)}
    >
      {label}
    </Link>
  );
}
