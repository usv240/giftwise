import { readFileSync } from "node:fs";
import { Client } from "pg";

/**
 * What a unit test needs beyond the checkout. A bare `npm test` (no database, no keys) skips such a test with the
 * reason in its name instead of waiting on a connection that never answers. scripts/test-results.mjs counts the
 * skipped tests by these tags and records the counts in content/test-results.json, which the README quotes.
 *
 * GIFTWISE_TEST_BARE=1 ignores .env.local and every key, so the recorded "nothing set" count is what a fresh checkout
 * gives, even on a machine that has keys. Values are used, never printed.
 */
export type Need = "database" | "claude" | "paypal";

export const NEED_TAG: Record<Need, string> = {
  database: "[needs a database]",
  claude: "[needs an Anthropic key]",
  paypal: "[needs PayPal sandbox keys]",
};

const bare = process.env.GIFTWISE_TEST_BARE === "1";
const localEnv = (() => {
  try {
    return readFileSync(".env.local", "utf8");
  } catch {
    return "";
  }
})();

/** A variable from the environment, else from .env.local; nothing at all in a bare run. */
export function envVar(name: string): string | undefined {
  if (bare) return undefined;
  const fromEnv = process.env[name]?.trim();
  if (fromEnv) return fromEnv;
  const m = localEnv.match(new RegExp(`^${name}=(.*)$`, "m"));
  const v = m?.[1]?.trim().replace(/^["']|["']$/g, "");
  return v || undefined;
}

let probe: Promise<boolean> | null = null;
/** Whether the database at this URL answers within 1.5 seconds, asked once per test file. */
function reachable(url: string) {
  probe ??= (async () => {
    const client = new Client({ connectionString: url, connectionTimeoutMillis: 1500, ssl: url.includes("render.com") ? { rejectUnauthorized: false } : undefined });
    try {
      await client.connect();
      await client.query("select 1");
      return true;
    } catch {
      return false;
    } finally {
      await client.end().catch(() => {});
    }
  })();
  return probe;
}

export type Have = { ok: boolean; why: string; url?: string };

/** Whether this run has what the need names, and the reason when it does not. */
export async function have(need: Need): Promise<Have> {
  if (need === "database") {
    const url = envVar("DATABASE_URL");
    if (!url) return { ok: false, why: "DATABASE_URL is not set" };
    if (!(await reachable(url))) return { ok: false, why: "the database at DATABASE_URL does not answer" };
    return { ok: true, why: "", url };
  }
  if (need === "claude") {
    const key = envVar("ANTHROPIC_API_KEY");
    return key && !/\s/.test(key) ? { ok: true, why: "" } : { ok: false, why: "ANTHROPIC_API_KEY is not set" };
  }
  const ok = Boolean(envVar("PAYPAL_CLIENT_ID") && envVar("PAYPAL_CLIENT_SECRET"));
  return ok ? { ok: true, why: "" } : { ok: false, why: "PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are not set" };
}

/** A suite's name with its need tagged, and the reason when it is skipped: "the rate_limit table [needs a database] (skipped: DATABASE_URL is not set)". */
export function suiteName(name: string, need: Need, h: Have) {
  return `${name} ${NEED_TAG[need]}${h.ok ? "" : ` (skipped: ${h.why})`}`;
}
