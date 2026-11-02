// Generates the sample documents used by the presets (fictional businesses, clearly marked SAMPLE).
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

type Doc = { file: string; vendor: string; address: string; title: string; to: string; number: string; date: string; due: string; lines: [string, number][]; note: string };

const docs: Doc[] = [
  {
    file: "riverside-mobility-quote.png",
    vendor: "Riverside Mobility Repair",
    address: "418 Mill Street, Springfield",
    title: "Repair Quote",
    to: "Maya Ortiz",
    number: "Q-20614",
    date: "2026-11-02",
    due: "2026-11-16",
    lines: [
      ["Push rim replacement (pair)", 260],
      ["Brake adjustment and alignment", 95],
      ["Labor, 1 hour", 65],
    ],
    note: "Payment accepted by PayPal. Repair scheduled once paid.",
  },
  {
    file: "northside-electric-bill.png",
    vendor: "Northside Electric Co-op",
    address: "PO Box 2200, Springfield",
    title: "Electric Service Statement",
    to: "Maya Ortiz",
    number: "Account 77-104-3391",
    date: "2026-11-01",
    due: "2026-11-20",
    lines: [
      ["Electric usage, 612 kWh", 112.3],
      ["Delivery charge", 19.2],
      ["Taxes and fees", 6.5],
    ],
    note: "Residential electric service. Amount due by the due date.",
  },
  {
    file: "eastgate-bookstore-quote.png",
    vendor: "Eastgate College Bookstore",
    address: "1 College Way, Springfield",
    title: "Order Quote",
    to: "Maya Ortiz, student",
    number: "EQ-5512",
    date: "2026-11-02",
    due: "2026-11-30",
    lines: [
      ["Laptop, 14 inch, student edition", 599],
      ["Accessibility keyboard tray", 50],
    ],
    note: "Required for online coursework, Spring term.",
  },
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const money = (n: number) => `$${n.toFixed(2)}`;

mkdirSync("public/samples", { recursive: true });
for (const d of docs) {
  const total = d.lines.reduce((s, l) => s + l[1], 0);
  const rows = d.lines
    .map(([t, a], i) => `<text x="60" y="${470 + i * 44}" font-size="22">${esc(t)}</text><text x="740" y="${470 + i * 44}" font-size="22" text-anchor="end">${money(a)}</text>`)
    .join("");
  const y = 470 + d.lines.length * 44 + 20;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
<rect width="800" height="1000" fill="#fdfdfb"/>
<text x="60" y="90" font-family="Arial" font-size="34" font-weight="bold" fill="#1d2a44">${esc(d.vendor)}</text>
<text x="60" y="124" font-family="Arial" font-size="18" fill="#555">${esc(d.address)}</text>
<text x="740" y="90" font-family="Arial" font-size="18" fill="#a33" text-anchor="end">SAMPLE DOCUMENT</text>
<text x="60" y="210" font-family="Arial" font-size="30" fill="#111">${esc(d.title)}</text>
<g font-family="Arial" font-size="20" fill="#222">
<text x="60" y="262">Bill to: ${esc(d.to)}</text>
<text x="60" y="296">${esc(d.number)}</text>
<text x="60" y="330">Date: ${d.date}</text>
<text x="60" y="364">Due: ${d.due}</text>
</g>
<rect x="60" y="410" width="680" height="2" fill="#bbb"/>
<g font-family="Arial" fill="#222">${rows}</g>
<rect x="60" y="${y}" width="680" height="2" fill="#bbb"/>
<text x="60" y="${y + 50}" font-family="Arial" font-size="26" font-weight="bold">Total due</text>
<text x="740" y="${y + 50}" font-family="Arial" font-size="26" font-weight="bold" text-anchor="end">${money(total)}</text>
<text x="60" y="${y + 120}" font-family="Arial" font-size="18" fill="#555">${esc(d.note)}</text>
<text x="60" y="960" font-family="Arial" font-size="15" fill="#999">Fictional business. Created for the Giftwise demo.</text>
</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`public/samples/${d.file}`);
  console.log("wrote", d.file, money(total));
}

writeFileSync(
  "public/samples/fundraiser.html",
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Help Maya get an accessible van (sample fundraiser)</title>
<style>body{font-family:Arial,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;line-height:1.55;color:#222}h1{font-size:30px}.bar{background:#eee;height:12px;border-radius:6px}.fill{background:#2a8a5b;height:12px;width:100%;border-radius:6px}.note{color:#a33}</style></head>
<body><p class="note">Sample fundraiser page for the Giftwise demo. Fictional.</p>
<h1>Help Maya get an accessible van</h1>
<p><strong>$6,000 raised</strong> of a $6,000 goal from 48 donors.</p><div class="bar"><div class="fill"></div></div>
<p>Maya is 29, lives on her own and uses a power wheelchair. She is starting community college this spring, and the bus route does not reach campus.</p>
<p>Here is what the money is for:</p>
<ul><li>$5,200 for a wheelchair ramp and lock-down conversion of a used minivan, done by Lakeside Mobility Conversions.</li>
<li>$500 for the first months of insurance on the van.</li>
<li>$300 for gas for her first semester of classes.</li></ul>
<p>Maya receives SSI, so we want to make sure the money reaches her in a way that does not affect her benefits.</p>
<p>Organized by Rosa, her mom.</p></body></html>`,
);
console.log("wrote fundraiser.html");
