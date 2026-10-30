import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { getConnection } from "@/db";
import { isLang } from "@/lib/i18n";
import type { Category, Finding } from "@/lib/types";
import { displayHost } from "@/lib/url";
import { getAudit } from "@/server/audits";

// The picture WhatsApp, X and Slack show when someone shares a report link:
// the store, its score and the five categories, readable at thumbnail size.
// English only: the image renderer can't shape Arabic script.

export const alt = "Kashf store check-up";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const C = { ink: "#141b2d", ink2: "#3b4459", faint: "#9ba2b4", paper: "#ffffff", ground: "#eef1f6", rule: "#dbe0ea", pen: "#2443d6", pass: "#0d8656", warn: "#b5760a", fail: "#d0392b" };
const tone = (n: number) => (n >= 90 ? C.pass : n >= 70 ? C.warn : C.fail);
const NAMES: [Category, string][] = [
  ["speed", "Speed"],
  ["search", "Search"],
  ["trust", "Trust"],
  ["mobile", "Mobile & Arabic"],
  ["security", "Security"],
];

export default async function Image({ params }: { params: Promise<{ lang: string; id: string }> }) {
  await connection();
  const { lang, id } = await params;
  const a = isLang(lang) ? await getAudit(await getConnection(), id) : null;
  const host = a ? displayHost(a.finalUrl ?? a.url) : "Kashf";
  const done = a?.status === "done" && a.score != null;
  const findings = (done ? (a.findings as Finding[] | null) : null) ?? [];
  const problems = findings.filter((f) => f.status === "fail").length;
  const smaller = findings.filter((f) => f.status === "warn").length;
  const cats = (a?.scores ?? {}) as Partial<Record<Category, number>>;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: C.ground, padding: 48, fontFamily: "sans-serif" }}>
        <div style={{ flex: 1, display: "flex", background: C.paper, borderRadius: 28, border: `2px solid ${C.rule}`, padding: "52px 60px" }}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 560 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 26, color: C.pen, fontWeight: 700 }}>Kashf store check-up</div>
              <div style={{ display: "flex", fontSize: host.length > 22 ? 48 : 60, color: C.ink, fontWeight: 800, marginTop: 18, lineHeight: 1.05 }}>{host}</div>
            </div>
            {done ? (
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <div style={{ display: "flex", fontSize: 168, lineHeight: 1, fontWeight: 800, color: tone(a.score!) }}>{a.score}</div>
                <div style={{ display: "flex", flexDirection: "column", marginLeft: 18, marginBottom: 22 }}>
                  <div style={{ display: "flex", fontSize: 34, color: C.ink2 }}>out of 100</div>
                  <div style={{ display: "flex", fontSize: 24, color: C.faint, marginTop: 6 }}>
                    {`${problems} ${problems === 1 ? "problem" : "problems"}, ${smaller} smaller ${smaller === 1 ? "note" : "notes"}`}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", fontSize: 40, color: C.ink2 }}>Checking speed, search, trust and mobile</div>
            )}
            <div style={{ display: "flex", fontSize: 22, color: C.faint }}>kashf-audit.vercel.app</div>
          </div>
          {done ? (
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", marginLeft: 56, flex: 1 }}>
              {NAMES.filter(([k]) => cats[k] != null).map(([k, name]) => {
                const v = cats[k]!;
                return (
                  <div key={k} style={{ display: "flex", flexDirection: "column", marginBottom: 26 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: C.ink2 }}>
                      <span>{name}</span>
                      <span style={{ color: C.ink, fontWeight: 700 }}>{v}</span>
                    </div>
                    <div style={{ display: "flex", height: 12, background: C.ground, borderRadius: 6, marginTop: 10 }}>
                      <div style={{ width: `${v}%`, height: 12, background: tone(v), borderRadius: 6 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    ),
    size,
  );
}
