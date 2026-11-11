import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import facts from "../content/facts.json";
import sources from "../content/sources.json";
import { IMPACT } from "@/lib/impact";
import { ABLE_MARKET, CONCURRENT, CONCURRENT_PERCENT, EXCESS_RESOURCES, ISM_COUNTED, ISM_IMPROPER, LAW, LIMIT, RECOVERY_RATE, SCALE, UPTAKE, repayMonths } from "@/lib/research";

/**
 * The measured-problem figures on /evidence/impact#stake, in docs/real-world.md and in the README: every one names a
 * source that has a url, a publisher and a page date, and code that exists; the arithmetic follows from the stated
 * inputs; the documents carry the same figures.
 */
const SRC = sources as Record<string, { title: string; url: string; publisher: string; date?: string }>;
const readme = readFileSync("README.md", "utf8");
const realWorld = readFileSync("docs/real-world.md", "utf8");
/** One `## ` section of a Markdown document, from its heading to the next one. */
const section = (doc: string, heading: string) => {
  const from = doc.indexOf(`\n${heading}\n`);
  expect(from, heading).toBeGreaterThanOrEqual(0);
  const next = doc.indexOf("\n## ", from + heading.length + 1);
  return doc.slice(from, next < 0 ? undefined : next);
};

describe("the problem, measured by Social Security", () => {
  it("every figure has a dated primary source and names code that exists", () => {
    for (const f of [...SCALE, ...LIMIT]) {
      const s = SRC[f.source];
      expect(s, f.id).toBeDefined();
      expect(s.url, f.id).toMatch(/^https:\/\//);
      expect(s.publisher, f.id).toBeTruthy();
      expect(s.date, f.id).toBeTruthy();
      for (const path of f.code) expect(existsSync(path), `${f.id}: ${path}`).toBe(true);
    }
    for (const u of UPTAKE) {
      expect(SRC[u.source], u.id).toBeDefined();
      expect(SRC[u.source].date, u.id).toBeTruthy();
    }
    expect(SCALE.slice(0, 3).map((f) => f.id)).toEqual(["asr-counted", "afr-ism-share", "oig-no-tools"]);
  });

  it("every row says where in its source the figure is: a table, a page, a Federal Register page, a section or the abstract", () => {
    const where = /\b(Tables? \d+|pp?\. \d+|\d+ FR \d+|Section [A-Z]|abstract|Market Sizing Data)\b/;
    for (const f of [...SCALE, ...LIMIT]) expect(f.locator, f.id).toMatch(where);
    for (const u of UPTAKE) expect(u.locator, u.id).toMatch(where);
  });

  it("the improper-payment figures add up as the report states them", () => {
    expect(Math.round((ISM_IMPROPER.over + ISM_IMPROPER.under) * 100) / 100).toBe(ISM_IMPROPER.total);
    expect(Math.round((ISM_IMPROPER.total / 5) * 100) / 100).toBe(ISM_IMPROPER.yearlyAverage);
    expect(ISM_COUNTED.people).toBeLessThan(793_000);
    expect(EXCESS_RESOURCES.limit).toBe(facts.values.resource_limit_individual.value);
    expect(ABLE_MARKET.asOf).toBe("June 30, 2026");
  });

  it("repayment months follow from the 10 percent recovery rate and the current check", () => {
    const monthly = facts.values.fbr_individual.value * RECOVERY_RATE;
    expect(RECOVERY_RATE).toBe(0.1);
    for (const c of IMPACT.askedCases) {
      const months = repayMonths(c.amount);
      expect(months * monthly).toBeGreaterThanOrEqual(c.amount);
      expect((months - 1) * monthly).toBeLessThan(c.amount);
      expect(SCALE.find((f) => f.id === "em-recovery-10")!.measures).toContain(`${months}`);
    }
  });

  it("the law table names sources that exist and rules the engine defines", () => {
    const table = readFileSync("src/lib/rules/table.ts", "utf8");
    for (const row of LAW) {
      for (const l of row.law) expect(SRC[l.key], l.key).toBeDefined();
      for (const id of row.rule.split(", ")) expect(table, id).toContain(`"${id}"`);
    }
  });

  it("the README's Why it matters block carries the same figures, each linked to its source", () => {
    const block = section(readme, "## Why it matters");
    const line = (figure: string) => block.split(/\r?\n/).find((l) => l.startsWith(`- **${figure}**`)) ?? "";
    const url = (key: string) => SRC[key].url.replace(/ /g, "%20");
    expect(line(ISM_COUNTED.people.toLocaleString("en-US"))).toContain(`${ISM_COUNTED.month} for help with shelter, by $${ISM_COUNTED.averageMonthly} a month on average`);
    expect(line(ISM_COUNTED.people.toLocaleString("en-US"))).toContain(url("ssa-asr-2024-sect02"));
    expect(line(`${ISM_IMPROPER.share} percent`)).toContain(url("ssa-afr-2025-payment-integrity"));
    expect(line(EXCESS_RESOURCES.suspended.toLocaleString("en-US"))).toContain(`savings over the ${`$${EXCESS_RESOURCES.limit.toLocaleString("en-US")}`} limit`);
    expect(line(EXCESS_RESOURCES.suspended.toLocaleString("en-US"))).toContain(url("ssa-asr-2024-sect11"));
    expect(line(ABLE_MARKET.accounts)).toContain(`on ${ABLE_MARKET.asOf}`);
    expect(line(ABLE_MARKET.accounts)).toContain(url("iss-able-2q-2026"));
    expect(line(ABLE_MARKET.accounts)).toContain(url("able-nrc-accounts-2026"));
    // The size of SSI, from content/facts.json and its source.
    const total = facts.audience.ssi_jan2025_total;
    expect(line(total.value)).toContain(`received SSI in ${/\(([^)]+)\)/.exec(total.label)![1]}`);
    expect(line(total.value)).toContain(url(total.source));
    expect(block.split(/\r?\n/).filter((l) => l.startsWith("- **"))).toHaveLength(5);
  });

  it("docs/real-world.md's what-is-at-stake block carries the same figures", () => {
    const block = section(realWorld, "## What is at stake, measured by Social Security");
    expect(block).toContain(ISM_COUNTED.people.toLocaleString("en-US"));
    expect(block).toContain(`$${ISM_COUNTED.averageMonthly}`);
    expect(block).toContain(`${ISM_IMPROPER.share} percent`);
    expect(block).toContain("no tools");
    expect(block).toContain("9 percent");
    expect(block).toContain("$132");
    expect(block).toContain(EXCESS_RESOURCES.suspended.toLocaleString("en-US"));
    expect(block).toContain(ABLE_MARKET.accounts);
    expect(block).toContain("10 percent");
    expect(block).toContain(`**${CONCURRENT_PERCENT} percent** of people paid SSI in ${CONCURRENT.month} also got Social Security, ${CONCURRENT.socialSecurity.toLocaleString("en-US")} of ${CONCURRENT.recipients.toLocaleString("en-US")}, and ${CONCURRENT.anothersHousehold.toLocaleString("en-US")} lived in another person's household`);
    expect(block).toContain(CONCURRENT.tables);
  });

  it("the situation questions' Info text states the same SSA figures, with the table", () => {
    const info = JSON.parse(readFileSync("content/info.json", "utf8")) as Record<string, { why: string; technical?: string }>;
    expect(info["situation.benefits"].why).toContain(`${CONCURRENT.socialSecurity.toLocaleString("en-US")} of the ${CONCURRENT.recipients.toLocaleString("en-US")} people paid SSI in ${CONCURRENT.month}, ${CONCURRENT_PERCENT} percent (SSA, SSI Annual Statistical Report 2024, Table 8)`);
    expect(info["situation.home"].why).toContain(`${CONCURRENT.anothersHousehold.toLocaleString("en-US")} people on SSI lived in another person's household in ${CONCURRENT.month} (SSA, SSI Annual Statistical Report 2024, Table 6)`);
    expect(info["manage.situation"].why).toContain(`${CONCURRENT_PERCENT} percent in ${CONCURRENT.month}`);
    expect(SRC[CONCURRENT.source].url).toBe("https://www.ssa.gov/policy/docs/statcomps/ssi_asr/2024/sect02.html");
  });
});
