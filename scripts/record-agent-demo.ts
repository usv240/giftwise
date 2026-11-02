// Record the outside-agent demo against a running Giftwise server, for the For agents page.
// Usage: npx tsx --env-file=.env.local scripts/record-agent-demo.ts [base-url]
import { writeFileSync } from "node:fs";
import { runAgentDemo } from "../src/lib/agent/demo";

async function main() {
  const base = process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:3100";
  await fetch(`${base}/api/demo/reset`, { method: "POST" });
  const run = await runAgentDemo(base);
  // Recorded runs point at the sample page, wherever the site is hosted. The order this run created lives only in the
  // database it ran against, so its PayPal link and receipt address are replaced; a live run on the page makes fresh ones.
  const local = (s: string) =>
    s
      .split(base)
      .join("")
      .replace(/https:\/\/www\.sandbox\.paypal\.com\/checkoutnow\?token=[A-Z0-9]+/g, "[PayPal approval link]")
      .replace(/\/r\/[A-Z0-9]{10,24}/g, "/r/[receipt]");
  const steps = run.steps.map((s) => ("text" in s ? { ...s, text: local(s.text) } : s));
  writeFileSync("content/agent-demo.json", JSON.stringify({ recorded_at: new Date().toISOString(), model: run.model, tools: run.tools, ms: run.ms, steps }, null, 2) + "\n");
  for (const s of steps) {
    if (s.kind === "call") console.log(`> ${s.tool}(${JSON.stringify(s.input)})`);
    else if (s.kind === "result") console.log(`  < ${s.isError ? "error: " : ""}${s.text.slice(0, 160)}`);
    else console.log(`${s.kind.toUpperCase()}: ${s.text.slice(0, 600)}`);
  }
  console.log(`\n${run.ms} ms`);
  await fetch(`${base}/api/demo/reset`, { method: "POST" });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
