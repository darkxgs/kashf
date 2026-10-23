/** The public origin of this deployment, for share links and the demo store. */
export function appUrl(): string {
  if (process.env.KASHF_PUBLIC_URL) return process.env.KASHF_PUBLIC_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** Local development audits its own demo store on localhost, which the network guard would refuse. */
export const allowPrivateTargets = () => process.env.KASHF_ALLOW_PRIVATE === "1" || (!process.env.VERCEL && process.env.NODE_ENV !== "production");
