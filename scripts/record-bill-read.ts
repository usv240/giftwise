// Record one live reading of the sample electric bill (public/samples/northside-electric-bill.png): the run the preset
// page shows, labelled, when this server has no AI key or the day's AI budget is spent. One Claude call.
// Usage: npx tsx --env-file=.env.local scripts/record-bill-read.ts
import { writeFileSync } from "node:fs";
import { readSampleBillLive } from "../src/lib/ai/sample-bill";

async function main() {
  const { bill, model, ms } = await readSampleBillLive();
  writeFileSync("content/reviews/electric-bill-read.json", JSON.stringify({ recorded_at: new Date().toISOString(), model, ms, data: bill }, null, 2) + "\n");
  console.log(`${bill.vendor_name}: ${bill.vendor_category}, $${bill.amount_due}, due ${bill.due_date} (${ms} ms, ${model})`);
}
void main();
