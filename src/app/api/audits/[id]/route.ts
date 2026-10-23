import { connection, type NextRequest } from "next/server";
import { getConnection } from "@/db";
import { expireStuck, getAudit } from "@/server/audits";

/** Progress for the report page while an audit runs. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/audits/[id]">) {
  await connection();
  const { id } = await ctx.params;
  const conn = await getConnection();
  let a = await getAudit(conn, id);
  if (!a) return Response.json({ error: "not_found" }, { status: 404 });
  if (a.status === "running" && Date.now() - a.createdAt.getTime() > 3 * 60_000) {
    await expireStuck(conn);
    a = (await getAudit(conn, id)) ?? a;
  }
  return Response.json({ status: a.status, steps: a.steps, psiStatus: a.psiStatus, error: a.error }, { headers: { "cache-control": "no-store" } });
}
