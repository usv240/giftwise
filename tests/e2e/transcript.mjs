// A redacted transcript of an end-to-end suite that moves sandbox money, written to content/eval/e2e-transcripts.json
// so each PayPal step can be read after the run: the step, the PayPal order and capture ids, how many payees, the
// statuses and the timings. Nothing else: no email address, no key, no token. Each suite writes its own entry and the
// others are kept.
//
//   const t = transcript("paypal");  t.step("need button creates an order", { order_id, payees: 1, ms });  t.save(passed, failed);
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const FILE = "content/eval/e2e-transcripts.json";
/** The fields a step may carry; anything else is dropped before it is written. */
const FIELDS = ["ok", "order_id", "capture_ids", "payees", "status", "paypal_status", "amount", "ms", "note", "batch_id"];
/** Anything shaped like an address, a key or a bearer token never reaches the file, whatever field it arrived in. */
const SECRET = /[\w.+-]+@[\w-]+\.[\w.-]+|\bgw_[A-Za-z0-9_]{16,}|\b(sk|key)-[A-Za-z0-9_-]{16,}|\bbearer\s+\S{8,}|\b(secret|token|password)\s*[:=]\s*\S+|\b[A-Za-z0-9_-]{40,}\b/i;

export function transcript(suite, base = process.env.BASE_URL ?? "http://localhost:3100") {
  const started = Date.now();
  const steps = [];
  const clean = (v) => {
    if (typeof v === "string") return SECRET.test(v) ? "[redacted]" : v;
    if (Array.isArray(v)) return v.map(clean);
    return v;
  };
  return {
    /** Record one step. `data` is filtered to the allowed fields and scrubbed. */
    step(name, data = {}) {
      const row = { step: String(name).slice(0, 160), at_ms: Date.now() - started };
      for (const k of FIELDS) if (data[k] !== undefined && data[k] !== null) row[k] = clean(data[k]);
      steps.push(row);
      return row;
    },
    /** Write this suite's entry, keeping the other suites' entries in the file. */
    save(passed, failed) {
      let doc = { about: "Redacted transcripts of the end-to-end suites that move PayPal sandbox money, one entry per suite: each step with its PayPal order and capture ids, payee count, statuses and timings. Written by tests/e2e/transcript.mjs from tests/e2e/paypal-button.mjs and tests/e2e/api.mjs; no email address, key or token is kept.", suites: {} };
      try {
        doc = JSON.parse(readFileSync(FILE, "utf8"));
      } catch {
        mkdirSync("content/eval", { recursive: true });
      }
      const host = (() => {
        try {
          return new URL(base).host;
        } catch {
          return "local";
        }
      })();
      doc.suites[suite] = { ran_at: new Date().toISOString(), against: /localhost|127\.0\.0\.1/.test(host) ? "a local production build, PayPal sandbox" : host, passed, failed, total_ms: Date.now() - started, steps };
      const text = JSON.stringify(doc, null, 2) + "\n";
      if (SECRET.test(text.replace(/"about":[^\n]*\n/, ""))) throw new Error("The transcript would carry something that looks like an address or a key; nothing was written.");
      writeFileSync(FILE, text);
      console.log(`transcript: ${steps.length} steps written to ${FILE}`);
    },
  };
}
