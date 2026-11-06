import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { replayable } from "@/lib/ai/claude";

describe("local test runs replay an identical Claude request instead of paying for it twice", () => {
  const before = process.env.AI_CACHE_DIR;
  afterEach(() => {
    if (before === undefined) delete process.env.AI_CACHE_DIR;
    else process.env.AI_CACHE_DIR = before;
  });

  it("calls once for the same request, and again for a changed one", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "gw-ai-"));
    process.env.AI_CACHE_DIR = dir;
    let calls = 0;
    const call = async () => ({ answer: ++calls });
    const req = { model: "m", messages: [{ role: "user", content: "the sample bill" }] };
    expect(await replayable(req, call)).toEqual({ answer: 1 });
    expect(await replayable(structuredClone(req), call)).toEqual({ answer: 1 });
    expect(await replayable({ ...req, model: "other" }, call)).toEqual({ answer: 2 });
    expect(calls).toBe(2);
    expect((await readdir(dir)).length).toBe(2);
    await rm(dir, { recursive: true, force: true });
  });

  it("always calls live when AI_CACHE_DIR is not set, as on the hosted site and in CI", async () => {
    delete process.env.AI_CACHE_DIR;
    let calls = 0;
    const call = async () => ++calls;
    await replayable({ a: 1 }, call);
    await replayable({ a: 1 }, call);
    expect(calls).toBe(2);
  });
});
