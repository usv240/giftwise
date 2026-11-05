import { describe, expect, it } from "vitest";
import { checkGiftData, docExamples, planMonthData, presetBody } from "@/app/developers/docs/examples";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { POST as checkGift } from "@/app/api/v1/check-gift/route";
import { POST as planMonth } from "@/app/api/v1/plan-month/route";
import { GET as preset } from "@/app/api/presets/[id]/route";

const post = (path: string, body: unknown) => new Request(`http://localhost${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const example = (id: string) => ENDPOINTS.find((e) => e.id === id)?.example;

// The docs page computes these examples with the handlers' own mapping; they must match what the API returns.
describe("API docs examples match the handlers", () => {
  it("check-gift", async () => {
    const res = await checkGift(post("/api/v1/check-gift", example("check-gift")));
    expect((await res.json()).data).toEqual(checkGiftData(example("check-gift")));
  });

  it("plan-month", async () => {
    const res = await planMonth(post("/api/v1/plan-month", example("plan-month")));
    expect((await res.json()).data).toEqual(planMonthData(example("plan-month")));
  });

  it("presets", async () => {
    const res = await preset(new Request("http://localhost/api/presets/electric-bill"), { params: Promise.resolve({ id: "electric-bill" }) });
    expect(await res.json()).toEqual(presetBody("electric-bill"));
  });

  it("every endpoint has an example request and response", () => {
    const ex = docExamples();
    for (const e of ENDPOINTS) {
      expect(ex[e.id], e.id).toBeDefined();
      expect(() => JSON.parse(ex[e.id].response), e.id).not.toThrow();
    }
  });
});
