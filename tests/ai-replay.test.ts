import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiUnavailableError, REPLAY_DIR, replayKey, replayable, resetReplayCount, structured } from "@/lib/ai/claude";
import { PASSAGES_FETCHED, SAMPLE_FUNDRAISER, SAMPLE_REVIEW, replayEntries, reviewCase } from "@/lib/ai/replay-set";
import { reviewPayload, runReviewers } from "@/lib/ai/reviewers";
import { sampleBillFile, sampleBillRead } from "@/lib/ai/sample-bill";
import { BillSchema, billRequest, readBill, readFundraiser } from "@/lib/ai/tasks";
import { readBundledSample } from "@/lib/sponsors/kernel";

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

describe("a clone with no AI key runs the real reader, reviewers and referee on Claude's recorded answers", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("AI_CACHE_DIR", "");
    resetReplayCount();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("holds exactly the answers the current code asks for, each from a named recording", async () => {
    const entries = await replayEntries();
    const onDisk = (await readdir(REPLAY_DIR)).filter((f) => f.endsWith(".json")).sort();
    // A changed prompt, schema or rulebook passage changes a key: record the sample again, then run scripts/build-ai-replay.ts.
    expect(onDisk).toEqual(entries.map((e) => `${e.key}.json`).sort());
    for (const e of entries) {
      const file = JSON.parse(await readFile(path.join(REPLAY_DIR, `${e.key}.json`), "utf8"));
      expect(file.parsed_output).toEqual(e.parsed_output);
      expect(file.source, e.what).toMatch(/^(content\/reviews|src\/app\/developers\/docs)\//);
      expect(Number.isNaN(Date.parse(file.recorded_at))).toBe(false);
    }
  });

  it("uses a reviewer recording only when it was asked with the rulebook passages the reviewers read now", async () => {
    const reviewers = (await replayEntries()).filter((e) => e.what.includes("reviewer"));
    expect(reviewers).toHaveLength(2);
    for (const e of reviewers) expect(e.recorded_at.slice(0, 10) > PASSAGES_FETCHED, `${e.what}: ${e.recorded_at} vs ${PASSAGES_FETCHED}`).toBe(true);
  });

  it("reads the sample bill, says it replayed, and the rules engine prices what was read", async () => {
    const r = await sampleBillRead();
    expect([r.mode, r.reason]).toEqual(["replayed", "no_key"]);
    expect(r.bill.vendor_name).toBe("Northside Electric Co-op");
    expect(r.check).toMatchObject({ paid_to_company: 876, through_able: 994 });
  });

  it("names an uploaded file by the bytes the visitor sent, so the key does not depend on how this machine re-encodes it", async () => {
    const file = await sampleBillFile();
    const reencoded = { ...file, base64: Buffer.from("another encoder's bytes").toString("base64") };
    expect(replayKey(billRequest(reencoded))).toBe(replayKey(billRequest(file)));
    expect(replayKey(billRequest({ ...file, fileSha256: "0".repeat(64) }))).not.toBe(replayKey(billRequest(file)));
    expect((await readBill(reencoded)).replayed).toBe(true);
  });

  it("runs both reviewers on the sample bill: two checked quotes, the referee's verdict and the route", async () => {
    const run = await runReviewers(reviewCase(SAMPLE_REVIEW));
    const out = reviewPayload(run);
    expect(run.replayed).toBe(true);
    expect(out.reviews.map((v) => [v.authority, v.answer, v.quote_checked])).toEqual([
      ["regs", "shelter", true],
      ["poms", "shelter", true],
    ]);
    expect(out.referee).toMatchObject({ decision: "shelter", agreed: true });
    expect(out.outcome).toMatchObject({ route: "able", check_after: 994 });
  });

  it("a page that shows the recorded run (replayOnly) runs the same code and writes no usage row", async () => {
    const run = await runReviewers(reviewCase(SAMPLE_REVIEW), undefined, { replayOnly: true });
    expect([run.replayed, run.decision, run.agreed]).toEqual([true, "shelter", true]);
  });

  it("reads the sample fundraiser by its path, whatever host it is served from", async () => {
    const page = await readBundledSample(SAMPLE_FUNDRAISER);
    const r = await readFundraiser(page!.text, `https://any-host.example${SAMPLE_FUNDRAISER}`, { keyUrl: SAMPLE_FUNDRAISER });
    expect(r.replayed).toBe(true);
    expect(r.data.uses.length).toBeGreaterThanOrEqual(2);
  });

  it("anything else still needs the key", async () => {
    await expect(runReviewers(reviewCase({ ...SAMPLE_REVIEW, amount: 139 }))).rejects.toBeInstanceOf(AiUnavailableError);
    await expect(readFundraiser("A different page", SAMPLE_FUNDRAISER, { keyUrl: SAMPLE_FUNDRAISER })).rejects.toBeInstanceOf(AiUnavailableError);
    // The sample fundraiser read at an outside address is an outside page, not the shipped sample.
    const page = await readBundledSample(SAMPLE_FUNDRAISER);
    await expect(readFundraiser(page!.text, `https://any-host.example${SAMPLE_FUNDRAISER}`)).rejects.toBeInstanceOf(AiUnavailableError);
  });

  it("with a key, a local test run's own cache still answers an identical request, so nothing is paid twice", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "gw-cache-"));
    // A placeholder, not a key: the cached answer is returned before any client call.
    vi.stubEnv("ANTHROPIC_API_KEY", "placeholder-not-a-key");
    vi.stubEnv("AI_CACHE_DIR", dir);
    const opts = { ...billRequest(await sampleBillFile()), content: [{ type: "text" as const, text: "a request only this test makes" }] };
    const { writeFile } = await import("node:fs/promises");
    const answer = (await replayEntries())[0].parsed_output;
    await writeFile(path.join(dir, `${replayKey(opts)}.json`), JSON.stringify({ parsed_output: answer, usage: null, model: "claude-opus-5-5", stop_reason: "end_turn" }));
    const r = await structured(opts);
    expect(r.replayed).toBe(true);
    expect(r.data).toEqual(answer);
    await rm(dir, { recursive: true, force: true });
  });

  it("never uses a recording that no longer fits the schema it answers", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "gw-replay-"));
    vi.stubEnv("AI_CACHE_DIR", dir);
    const opts = { ...billRequest(await sampleBillFile()), content: [{ type: "text" as const, text: "a request only this test makes" }] };
    const { writeFile } = await import("node:fs/promises");
    await writeFile(path.join(dir, `${replayKey(opts)}.json`), JSON.stringify({ parsed_output: { vendor_name: 7 }, usage: null, model: "m", stop_reason: "end_turn" }));
    await expect(structured(opts)).rejects.toBeInstanceOf(AiUnavailableError);
    expect(BillSchema.safeParse({ vendor_name: 7 }).success).toBe(false);
    await rm(dir, { recursive: true, force: true });
  });
});
