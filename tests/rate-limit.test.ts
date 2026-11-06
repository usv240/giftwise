import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decide, hit, prune, release } from "@/lib/rate-limit";

describe("rate limit decisions", () => {
  it("allows up to the limit in a window and says when it reopens", () => {
    const start = new Date("2026-11-06T10:00:00Z");
    const at = Date.parse("2026-11-06T10:00:20Z");
    expect(decide(1, 20, start, 60, at)).toMatchObject({ allowed: true, remaining: 19, retryAfterSec: 40 });
    expect(decide(20, 20, start, 60, at)).toMatchObject({ allowed: true, remaining: 0 });
    expect(decide(21, 20, start, 60, at)).toMatchObject({ allowed: false, remaining: 0, retryAfterSec: 40 });
    expect(decide(5, 1, start, 600, at).retryAfterSec).toBe(580);
  });
});

/** The table itself, when a database is reachable (DATABASE_URL in .env.local; CI's Postgres has it too). */
const localEnv = (() => {
  try {
    return readFileSync(".env.local", "utf8");
  } catch {
    return "";
  }
})();
const url = process.env.DATABASE_URL || localEnv.match(/^DATABASE_URL=(.+)$/m)?.[1];
describe.skipIf(!url)("the rate_limit table", () => {
  const bucket = `test:${Date.now()}`;
  beforeAll(() => {
    process.env.DATABASE_URL ??= url;
  });
  afterAll(async () => {
    await release(bucket, 60);
    await release(`${bucket}:b`, 60);
  });
  it("one upsert counts and decides, across callers of the same bucket", async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => hit(bucket, 60, 3)));
    const counts = results.map((r) => r.count).sort((a, b) => a - b);
    expect(counts).toEqual([1, 2, 3, 4, 5]);
    expect(results.filter((r) => r.allowed)).toHaveLength(3);
    expect(results.filter((r) => !r.allowed)).toHaveLength(2);
  });
  it("another bucket is its own count, and release reopens a window", async () => {
    expect((await hit(`${bucket}:b`, 60, 1)).allowed).toBe(true);
    expect((await hit(`${bucket}:b`, 60, 1)).allowed).toBe(false);
    await release(`${bucket}:b`, 60);
    expect((await hit(`${bucket}:b`, 60, 1)).allowed).toBe(true);
  });
  it("pruning runs without error", async () => {
    await expect(prune()).resolves.toBeUndefined();
  });
});
