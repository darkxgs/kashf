import "server-only";
import type { Connection } from "@/db";
import { rawQuery } from "@/db/raw";

/**
 * Claims the right to run a job. Returns false when it ran within the last
 * `everySec` seconds, so bursts of traffic never fan out into duplicate work.
 * Also used as a simple rate limit ("check now" at most every 30 s).
 */
export async function claim(conn: Connection, key: string, everySec: number, force = false) {
  const rows = await rawQuery<{ key: string }>(
    conn.raw,
    `INSERT INTO kashf.app_jobs (key, ran_at) VALUES ($1, now())
     ON CONFLICT (key) DO UPDATE SET ran_at = excluded.ran_at
     WHERE $3::boolean OR kashf.app_jobs.ran_at < now() - make_interval(secs => $2::int)
     RETURNING key`,
    [key, everySec, force],
  );
  return rows.length > 0;
}

