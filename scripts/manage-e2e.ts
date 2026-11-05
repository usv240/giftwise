// The organizer's side, end to end through the app's own API: the sample page's manage link; add, edit and remove a
// need and see the rules choose its route; close and reopen the page; a webhook that receives a signed test event and
// then a real gift.received when PayPal captures a card-approved sandbox order; and a new page's own manage link.
// Needs the server (BASE_URL, default http://localhost:3100) started with GIFTWISE_WEBHOOK_ALLOW_LOCAL=1 so it may
// post to this machine; without it the webhook checks are skipped, not failed.
import { createServer } from "node:http";
import { paypalRest } from "../src/lib/paypal/client";
import { verifySignature } from "../src/lib/manage";

const B = process.env.BASE_URL ?? "http://localhost:3100";
const T = "maya-sample-organizer";
let passed = 0;
let failed = 0;
const ok = (name: string, cond: boolean, extra = "") => {
  if (cond) passed++;
  else failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  | ${extra}` : ""}`);
};
async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch(`${B}${path}`, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, json: (await r.json().catch(() => null)) as { data?: Record<string, unknown> & { [k: string]: unknown }; error?: { message: string } } | null };
}

type Received = { body: string; signature: string; event: string };
const received: Received[] = [];
const server = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    received.push({ body, signature: String(req.headers["giftwise-signature"] ?? ""), event: String(req.headers["giftwise-event"] ?? "") });
    res.writeHead(204).end();
  });
});
const waitFor = async (pred: () => boolean, ms = 15000) => {
  const t = Date.now();
  while (!pred() && Date.now() - t < ms) await new Promise((r) => setTimeout(r, 200));
  return pred();
};

async function main() {
  await new Promise<void>((r) => server.listen(3199, "127.0.0.1", () => r()));
  await api("/api/demo/reset", "POST", {});

  // 1. The sample's organizer view
  let r = await api(`/api/manage/${T}`);
  const needs = (r.json?.data?.needs ?? []) as { id: number; title: string; route: string }[];
  ok("the sample page's manage link opens its four needs", r.status === 200 && needs.length === 4, `${r.status} ${needs.map((n) => n.title).join(", ")}`);
  ok("a wrong manage link finds nothing", (await api("/api/manage/not-a-real-token-123")).status === 404);

  // 2. Add, edit and remove a need: the rules choose the route each time
  r = await api(`/api/manage/${T}/needs`, "POST", { title: "Rent for December", amount: 650, category: "rent", vendor: "Her landlord" });
  const added = r.json?.data as { id: number; route: string; paid_to: string } | undefined;
  ok("a rent need goes to her ABLE account, whatever payee the organizer typed", r.status === 200 && added?.route === "able" && added.paid_to === "Maya's ABLE account", JSON.stringify(added));
  r = await api(`/api/manage/${T}/needs/${added?.id}`, "PATCH", { title: "Bus pass", amount: 64, category: "transport", vendor: "the city transit office" });
  ok("changed to a bus pass, the same need is paid straight to the transit office", r.status === 200 && r.json?.data?.route === "vendor" && r.json?.data?.paid_to === "City transit office", JSON.stringify(r.json?.data));
  const page = await (await fetch(`${B}/g/maya`)).text();
  ok("the new need shows on the page givers see", page.includes("Bus pass"));
  r = await api(`/api/manage/${T}/needs/${added?.id}`, "DELETE");
  ok("a need nobody has paid toward can be removed", r.status === 200 && !(await (await fetch(`${B}/g/maya`)).text()).includes("Bus pass"));
  r = await api(`/api/manage/${T}/needs`, "POST", { title: "x", amount: 0, category: "rent" });
  ok("a need with no amount is refused with a plain message", r.status === 400 && /amount/.test(r.json?.error?.message ?? ""));

  // 2b. The gift finder: products checked against the rules, a gift card held back, and one added with its link
  r = await api(`/api/manage/${T}/find?q=${encodeURIComponent("wheelchair cushion")}`);
  const found = (r.json?.data?.products ?? []) as { title: string; addable: boolean; giftCard: boolean; price: number; category: string; domain: string | null; url: string | null }[];
  const mode = String(r.json?.data?.mode ?? "");
  const pick = found.find((p) => p.addable);
  ok(`the gift finder returns products, each checked against the rules (${mode})`, r.status === 200 && found.length > 0 && Boolean(pick), `${found.length} found`);
  r = await api(`/api/manage/${T}/find?q=${encodeURIComponent("grocery gift card")}`);
  const cards = ((r.json?.data?.products ?? []) as { giftCard: boolean; addable: boolean }[]).filter((p) => p.giftCard);
  ok("a gift card is found but held back, because SSA counts it like cash", r.status === 200 && (mode === "live" ? cards.every((c) => !c.addable) : cards.length > 0 && cards.every((c) => !c.addable)));
  if (pick) {
    const link = pick.url ?? "https://mobility.example/cushion";
    r = await api(`/api/manage/${T}/needs`, "POST", { title: pick.title.slice(0, 80), amount: pick.price, category: pick.category, vendor: pick.domain, link });
    const giftPage = await (await fetch(`${B}/g/maya`)).text();
    ok("a found product goes on the page, paid straight to the retailer, with a link givers can open", r.status === 200 && r.json?.data?.route === "vendor" && giftPage.includes(pick.title.slice(0, 40).replace(/&/g, "&amp;")) && giftPage.includes("See it at"), JSON.stringify(r.json?.data));
    await api(`/api/manage/${T}/needs/${(r.json?.data as { id?: number } | undefined)?.id}`, "DELETE");
  }

  // 3. Close and reopen
  r = await api(`/api/manage/${T}`, "PATCH", { status: "closed" });
  const closedOrder = await api("/api/paypal/gift-orders", "POST", { slug: "maya", amount: 100 });
  const closedPage = await (await fetch(`${B}/g/maya`)).text();
  ok("a closed page takes no new gifts and says so", r.status === 200 && closedOrder.status === 409 && closedPage.includes("closed to new gifts"), `${closedOrder.status}`);
  r = await api(`/api/manage/${T}`, "PATCH", { status: "open" });
  ok("reopened, it takes gifts again", r.status === 200 && (await api("/api/paypal/gift-orders", "POST", { slug: "maya", amount: 100 })).status === 200);

  // 4. Webhooks: private addresses refused; a signed test event; a real gift.received after a PayPal capture
  r = await api(`/api/manage/${T}/webhook`, "PUT", { url: "https://10.0.0.5/hook" });
  ok("a webhook on a private network is refused", r.status === 400, r.json?.error?.message);
  r = await api(`/api/manage/${T}/webhook`, "PUT", { url: "http://127.0.0.1:3199/hook" });
  const secret = String(r.json?.data?.secret ?? "");
  if (r.status !== 200) {
    console.log("SKIP  webhook delivery: start the server with GIFTWISE_WEBHOOK_ALLOW_LOCAL=1 to receive events on this machine");
  } else {
    ok("the webhook is saved with its own signing secret", secret.startsWith("whsec_"));
    r = await api(`/api/manage/${T}/webhook`, "POST");
    const gotTest = await waitFor(() => received.some((x) => x.event === "gift.test"));
    const test = received.find((x) => x.event === "gift.test");
    ok("a test event arrives, signed with that secret", r.status === 200 && gotTest && verifySignature(secret, test!.body, test!.signature), `${r.status} ${received.length}`);

    const created = await api("/api/paypal/gift-orders", "POST", { slug: "maya", amount: 500 });
    const id = String((created.json?.data as { id?: string } | undefined)?.id ?? "");
    const confirm = await paypalRest<{ status?: string }>(`/v2/checkout/orders/${id}/confirm-payment-source`, {
      method: "POST",
      body: JSON.stringify({ payment_source: { card: { number: "4012888888881881", expiry: "2030-12", name: "Joe Ortiz", security_code: "123" } } }),
    });
    const cap = await api(`/api/paypal/orders/${id}/capture`, "POST", {});
    const gotGift = await waitFor(() => received.some((x) => x.event === "gift.received"));
    const gift = received.find((x) => x.event === "gift.received");
    const ev = gift ? (JSON.parse(gift.body) as { gift: { amount: number; recipients: unknown[]; receipt_url: string }; check: { amount: number; counted_as_income: number } }) : null;
    ok(
      "when PayPal captures a $500 gift, the webhook gets gift.received: signed, the recipients, the receipt and her check with $0 counted",
      confirm.status < 300 && cap.status === 200 && gotGift && verifySignature(secret, gift!.body, gift!.signature) && ev?.gift.amount === 500 && ev.gift.recipients.length >= 2 && ev.gift.receipt_url.endsWith(`/r/${id}`) && ev.check.counted_as_income === 0,
      ev ? `${ev.gift.recipients.length} recipients, check ${ev.check.amount}` : `capture ${cap.status}`,
    );
    const view = await api(`/api/manage/${T}`);
    ok("the gift shows in the organizer's list", ((view.json?.data?.gifts ?? []) as unknown[]).length >= 2);
    r = await api(`/api/manage/${T}/webhook`, "PUT", { url: null });
    ok("the webhook can be removed", r.status === 200);
  }

  // 5. A new page has its own manage link, shown once
  r = await api("/api/v1/gift-pages", "POST", { name: "Jordan", pronoun: "they", organizer: "E2E", needs: [{ title: "Van wheelchair lift", amount: 1800, category: "equipment", vendor: "a van conversion shop" }] });
  const manageUrl = String(r.json?.data?.manage_url ?? "");
  const own = manageUrl ? await api(`/api${manageUrl}`) : null;
  ok("a new page returns its own manage link, and it opens that page", r.status === 200 && /^\/manage\/[A-Za-z0-9_-]{24}$/.test(manageUrl) && own?.status === 200 && (own.json?.data?.page as { name?: string } | undefined)?.name === "Jordan", manageUrl);
  const manageHtml = manageUrl ? await (await fetch(`${B}${manageUrl}?new=1`)).text() : "";
  ok("the manage page asks the organizer to keep the link", manageHtml.includes("Keep this link"));

  await api("/api/demo/reset", "POST", {});
  const reset = await api(`/api/manage/${T}`);
  ok("resetting the sample puts its needs and its open status back", ((reset.json?.data?.needs ?? []) as unknown[]).length === 4 && (reset.json?.data?.page as { status?: string } | undefined)?.status === "open");
}

main()
  .catch((e) => {
    console.error(e);
    failed++;
  })
  .finally(() => {
    server.close();
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exitCode = failed ? 1 : 0;
  });
