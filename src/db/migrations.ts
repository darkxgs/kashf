// Schema changes, in order. Everything lives in the "kashf" schema so Kashf
// can share a Postgres database with other apps.
export const migrations: { name: string; sql: string }[] = [
  {
    name: "0001_init",
    sql: `
CREATE TABLE kashf.audits (
  id           text PRIMARY KEY,
  url          text NOT NULL,
  host         text NOT NULL,
  final_url    text,
  status       text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'failed')),
  error        text,
  error_status int,
  steps        jsonb NOT NULL DEFAULT '[]',
  platform     text,
  score        int,
  scores       jsonb,
  findings     jsonb,
  facts        jsonb,
  psi          jsonb,
  psi_status   text CHECK (psi_status IN ('running', 'done', 'failed', 'skipped')),
  ip_hash      text,
  is_demo      boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz
);
-- Report history per store, newest first; and the per-visitor rate limit.
CREATE INDEX audits_host_time ON kashf.audits (host, created_at DESC);
CREATE INDEX audits_ip_time ON kashf.audits (ip_hash, created_at DESC);

CREATE TABLE kashf.app_jobs (
  key    text PRIMARY KEY,
  ran_at timestamptz NOT NULL
);
`,
  },
];
