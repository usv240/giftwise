/**
 * The address visitors use to reach this app, with no trailing slash. Behind Render's proxy a request's own URL
 * names the internal port (localhost:10000), so on Render links, redirects and self-fetches use the public address
 * Render provides in RENDER_EXTERNAL_URL. Everywhere else the request's own origin is right.
 */
export function publicOrigin(req?: Request): string {
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, "");
  return req ? new URL(req.url).origin : "http://localhost:3000";
}

/** The hosted demo, shown where no request is at hand (for example, the MCP address printed on /agents). */
export const HOSTED_URL = "https://giftwise-405i.onrender.com";

/** The public address for a page rendered on the server: Render's, or the host the visitor used. */
export async function pageOrigin(): Promise<string> {
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, "");
  const { headers } = await import("next/headers");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return "http://localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
