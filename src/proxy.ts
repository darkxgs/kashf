import { NextResponse, type NextRequest } from "next/server";

/** "/" goes to the visitor's language: their earlier choice, else their browser's first language. */
export function proxy(req: NextRequest) {
  const saved = req.cookies.get("kashf_lang")?.value;
  const first = (req.headers.get("accept-language") ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  const lang = saved === "ar" || saved === "en" ? saved : first.startsWith("ar") ? "ar" : "en";
  return NextResponse.redirect(new URL(`/${lang}${req.nextUrl.search}`, req.url));
}

export const config = { matcher: ["/"] };
