// Record the docs page's example responses for the endpoints this round changed, from a running server: the letter
// reader on the sample letter (made up for this demo; it replays Claude's recorded reading with no key, so no Claude
// call) and a new gift page made with a profile. Each is written into src/app/developers/docs/recorded.json with the day
// it was recorded (recorded_on), and the manage token is replaced, as in the other recordings, since it is shown once.
// Usage: BASE_URL=http://localhost:3100 npx tsx scripts/record-docs-responses.ts
import { readFileSync, writeFileSync } from "node:fs";
import { ENDPOINTS } from "../src/lib/api/endpoints";

const B = process.env.BASE_URL ?? "http://localhost:3100";
const FILE = "src/app/developers/docs/recorded.json";
const doc = JSON.parse(readFileSync(FILE, "utf8"));
const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
// A documentation address of its own, so this run's new page is counted apart from the test suites' daily limits.
const from = { "x-forwarded-for": "198.51.100.250" };

async function main() {
  const letter = new FormData();
  letter.append("file", new Blob([readFileSync("public/samples/sam-ssa-letter-sample.pdf")], { type: "application/pdf" }), "sam-ssa-letter-sample.pdf");
  letter.append("pronoun", "he");
  const read = await (await fetch(`${B}/api/v1/read-letter`, { method: "POST", body: letter, headers: from })).json();
  if (!read.data) throw new Error(`read-letter: ${JSON.stringify(read.error)}`);

  const page = await (await fetch(`${B}/api/v1/gift-pages`, { method: "POST", headers: { "Content-Type": "application/json", ...from }, body: JSON.stringify(ENDPOINTS.find((e) => e.id === "gift-pages")!.example) })).json();
  if (!page.data) throw new Error(`gift-pages: ${JSON.stringify(page.error)}`);
  page.data.manage_url = "/manage/[private token, shown once]";

  doc.responses["read-letter"] = read;
  doc.responses["gift-pages"] = page;
  doc.recorded_on = { ...(doc.recorded_on ?? {}), "read-letter": day, "gift-pages": day };
  writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n");
  console.log(`read-letter: ${read.data.check.plain} (replayed: ${read.meta.replayed}); gift-pages: ${page.data.slug}, check ${page.data.check.amount}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
