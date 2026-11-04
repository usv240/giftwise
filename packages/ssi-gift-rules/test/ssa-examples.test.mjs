// The built package against Social Security's own worked examples (examples/ssa-examples.json): the same scoring
// Giftwise uses in scripts/run-ssa-examples.ts. Every scored example the engine matches must still match.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DEFAULT_PROFILE, computeMonth, planMonths } from "../dist/index.js";

const data = JSON.parse(readFileSync(new URL("../examples/ssa-examples.json", import.meta.url), "utf8"));
const published = JSON.parse(readFileSync(new URL("../examples/ssa-examples-results.json", import.meta.url), "utf8"));
const TOLERANCE = 1;

function engine(c) {
  const profile = { ...DEFAULT_PROFILE, ableEligible: true, savings: 0, ...c.profile };
  const plan = planMonths(c.gifts, profile);
  const byMonth = new Map(plan.months.map((m) => [m.month, m]));
  const read = (month, measure) => {
    const t = byMonth.get(month);
    if (measure === "ssi_amount") return t?.check ?? computeMonth(month, [], profile).check;
    if (!t) return 0;
    if (measure === "ism_value") return t.ismValue;
    return Math.round((t.cashIncome + t.inKindIncome + t.ismValue - t.infrequentExcluded) * 100) / 100;
  };
  const counts = plan.months.some((m) => m.cashIncome + m.inKindIncome + m.ismValue - m.infrequentExcluded > 0);
  return { counts, values: c.expected.values.map((v) => ({ ...v, got: read(v.month, v.measure) })) };
}

const matches = (c) => {
  const r = engine(c);
  return r.counts === c.expected.counts && r.values.every((v) => Math.abs(v.got - v.value) <= TOLERANCE);
};

test("gives the same answer as Giftwise's published results on every SSA worked example", () => {
  const byId = new Map(published.cases.map((c) => [c.id, c.engine.match]));
  let agree = 0;
  for (const c of data.cases) {
    assert.ok(byId.has(c.id), `${c.id} is in the published results`);
    assert.equal(matches(c), byId.get(c.id), `${c.id} (${c.cite})`);
    if (matches(c)) agree++;
  }
  console.log(`${agree} of ${data.cases.length} of SSA's worked examples match SSA's answer`);
});

test("a $1,000 cash gift lowers the check to $74; the same $1,000 paid to the shop leaves it at $994", () => {
  const cash = planMonths([{ id: "a", date: "2026-04-10", amount: 1000, delivery: "cash", category: "other" }], DEFAULT_PROFILE);
  const shop = planMonths([{ id: "b", date: "2026-04-10", amount: 1000, delivery: "vendor", category: "equipment" }], DEFAULT_PROFILE);
  assert.equal(cash.months[0].check, 74);
  assert.equal(shop.months[0].check, 994);
});
