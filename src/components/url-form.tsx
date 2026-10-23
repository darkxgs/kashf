"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { startAudit, type StartState } from "@/app/[lang]/actions";
import { buttonClass, cn, Spinner } from "./ui";

/** The one thing the home page asks for: a store's address. */
export function UrlForm({ lang, labels }: { lang: "ar" | "en"; labels: { placeholder: string; cta: string; invalid: string; private: string; limited: string } }) {
  const [state, action, pending] = useActionState<StartState, FormData>(startAudit, null);
  const fromRedirect = useSearchParams().get("error");
  const error = state?.error ?? (fromRedirect === "invalid" || fromRedirect === "private" || fromRedirect === "limited" ? fromRedirect : undefined);
  return (
    <form action={action} className="w-full max-w-xl">
      <input type="hidden" name="lang" value={lang} />
      <div
        className={cn(
          "flex items-stretch gap-1.5 rounded-[14px] border bg-paper p-1.5 shadow-[0_1px_0_rgb(20_27_45/0.04),0_12px_32px_-16px_rgb(36_67_214/0.35)] transition-colors focus-within:border-pen",
          error ? "border-fail" : "border-rule",
        )}
      >
        <label htmlFor="store-url" className="sr-only">
          {labels.placeholder}
        </label>
        <input
          id="store-url"
          name="url"
          type="text"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          required
          dir="ltr"
          defaultValue={state?.value}
          placeholder={labels.placeholder}
          aria-invalid={!!error}
          aria-describedby={error ? "url-error" : undefined}
          className="h-12 min-w-0 flex-1 rounded-[10px] bg-transparent px-3.5 text-[17px] text-ink placeholder:text-faint focus:outline-none"
        />
        <button type="submit" disabled={pending} className={buttonClass("pen", "md", "h-12 shrink-0 rounded-[10px] px-5")}>
          {pending ? <Spinner /> : null}
          {labels.cta}
        </button>
      </div>
      {error ? (
        <p id="url-error" role="alert" className="mt-2.5 text-[14px] text-fail">
          {labels[error]}
        </p>
      ) : null}
    </form>
  );
}
