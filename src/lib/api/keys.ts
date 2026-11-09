import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { db, dbConfigured, schema } from "../db";
import { hit } from "../rate-limit";
import { fail } from "./envelope";

const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const KEY_PREFIX = "gw_test_";
export const LIMITS = { keyPerMinute: 60, keyPerDay: 1000, demoPerMinute: 20 } as const;

/** gw_test_ followed by 32 random bytes in base62 (43 characters). */
export function newKey() {
  let out = "";
  while (out.length < 43) {
    for (const b of randomBytes(64)) if (b < 248 && out.length < 43) out += B62[b % 62];
  }
  return KEY_PREFIX + out;
}

export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");
export const displayPrefix = (key: string) => key.slice(0, 12);

/**
 * Where the caller's address is read from, most trusted first. The hosted site sits behind Cloudflare, which sets
 * cf-connecting-ip and true-client-ip itself on every request, so a caller cannot choose them. X-Forwarded-For's
 * first entry can be written by the caller, so it is used only when neither of those is present (a local server or
 * the test suites), with x-real-ip after it.
 */
export const ADDRESS_HEADERS = ["cf-connecting-ip", "true-client-ip", "x-forwarded-for", "x-real-ip"] as const;
export type AddressSource = (typeof ADDRESS_HEADERS)[number] | "none";

/** The caller's address and the header it came from. The address never leaves this module unhashed. */
export function clientAddress(req: Request): { ip: string; source: AddressSource } {
  for (const name of ADDRESS_HEADERS) {
    const raw = req.headers.get(name);
    const ip = (name === "x-forwarded-for" ? raw?.split(",")[0] : raw)?.trim();
    if (ip) return { ip, source: name };
  }
  return { ip: "local", source: "none" };
}

/** The caller's IP, hashed with a server secret so the request log never stores raw addresses. */
export function clientId(req: Request) {
  const { ip } = clientAddress(req);
  return createHash("sha256")
    .update(`${process.env.AUDIT_SALT ?? "giftwise"}:${ip}`)
    .digest("hex")
    .slice(0, 24);
}

function bearer(req: Request) {
  const h = req.headers.get("authorization");
  if (h?.toLowerCase().startsWith("bearer ")) return h.slice(7).trim();
  return req.headers.get("x-api-key")?.trim() || null;
}

function withHeaders(res: Response, headers: Record<string, string>) {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(headers)) h.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

/**
 * Every public API call goes through here. A key is optional: without one, calls use the demo tier
 * (20 a minute per client), which is what this site's own pages use. With a key: 60 a minute and
 * 1,000 a day, and the call shows up on the key's usage page. The counts live in the rate_limit table
 * (src/lib/rate-limit.ts), so they hold across instances and deploys; api_requests keeps the usage page's rows.
 */
export async function guard(req: Request, endpoint: string, handler: () => Promise<Response>) {
  if (!dbConfigured()) return handler();
  const started = Date.now();
  const token = bearer(req);
  const client = clientId(req);
  let keyId: number | null = null;
  let limit: number = LIMITS.demoPerMinute;
  let remaining: number;

  if (token) {
    const [key] = await db()
      .select()
      .from(schema.apiKeys)
      .where(and(eq(schema.apiKeys.hash, hashKey(token)), isNull(schema.apiKeys.revokedAt)))
      .limit(1);
    if (!key) return fail("unauthorized", "That API key is not valid or was revoked. Create a new one on the Developers page.", 401);
    keyId = key.id;
    limit = LIMITS.keyPerMinute;
    const [minute, day] = await Promise.all([hit(`key:${key.id}:minute`, 60, limit), hit(`key:${key.id}:day`, 86400, LIMITS.keyPerDay)]);
    if (!day.allowed) return withHeaders(fail("rate_limited", "This key has made 1,000 requests today. The limit resets over the next 24 hours.", 429), { "Retry-After": "3600" });
    if (!minute.allowed) return withHeaders(fail("rate_limited", "Too many requests this minute. Please wait a moment and try again.", 429), { "Retry-After": "60" });
    remaining = minute.remaining;
  } else {
    const minute = await hit(`client:${client}:minute`, 60, limit);
    if (!minute.allowed) {
      return withHeaders(fail("rate_limited", "Too many requests this minute. Wait a moment, or use a free API key for higher limits.", 429), { "Retry-After": "60" });
    }
    remaining = minute.remaining;
  }

  const res = await handler();
  const ms = Date.now() - started;
  await db().insert(schema.apiRequests).values({ keyId, client: keyId ? "" : client, endpoint, status: res.status, ms });
  if (keyId) await db().update(schema.apiKeys).set({ lastUsedAt: new Date() }).where(eq(schema.apiKeys.id, keyId));
  return withHeaders(res, { "X-RateLimit-Limit": String(limit), "X-RateLimit-Remaining": String(Math.max(0, remaining)) });
}

export const OWNER_COOKIE = "gw_owner";
export const newOwnerId = () => randomBytes(18).toString("base64url");

/** Create and store a key. Returns the full key: the only time it exists outside the caller's hands. */
export async function issueKey(o: { name: string; email: string; purpose: string; ownerId: string; ip: string }) {
  const key = newKey();
  const [row] = await db()
    .insert(schema.apiKeys)
    .values({ prefix: displayPrefix(key), hash: hashKey(key), name: o.name, email: o.email.toLowerCase(), purpose: o.purpose, ownerId: o.ownerId, createdIp: o.ip })
    .returning();
  return { key, row };
}

/** Resolve a key id that belongs to this browser's owner cookie. */
export async function ownedKeyId(params: Promise<{ id: string }>) {
  const id = Number((await params).id);
  const ownerId = (await cookies()).get(OWNER_COOKIE)?.value;
  return Number.isInteger(id) && ownerId ? { id, ownerId } : null;
}
