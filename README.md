# Giftwise

Benefit-safe giving for people on SSI. Family and friends give through PayPal, and Giftwise pays the shop, the clinic or the person's ABLE account directly, so the monthly check stays whole.

- **Live demo:** [giftwise-405i.onrender.com](https://giftwise-405i.onrender.com) (PayPal sandbox, no Giftwise login needed)
- **For judges:** start at [`/judges`](https://giftwise-405i.onrender.com/judges). The sandbox buyer login and step-by-step checks are in [TESTING.md](TESTING.md).

## The problem in one number

About 7.3 million people receive SSI (September 2026). SSI counts cash gifts as income. Give Maya $1,000 in cash and, two months later, her $994 check drops to $74. Pay the shop for something she needs and the same $1,000 leaves her check at $994. Giftwise does that routing for every gift, with the rule and its source shown each time ([20 CFR 416.1121](https://www.ecfr.gov/current/title-20/chapter-III/part-416/subpart-K/section-416.1121), [POMS SI 00830.520](https://secure.ssa.gov/poms.nsf/lnx/0500830520)).

## How it works

1. **A page of needs.** A family member lists what the person needs and who sells it, or makes the page from a fundraiser link. The sample is Maya's page at `/g/maya`.
2. **Any amount, routed by the rules.** A donor types one number. A deterministic rules engine splits it across the needs and the ABLE account so that none of it counts as income, and shows the check before and after.
3. **One PayPal checkout, many payees.** Giftwise creates one Orders v2 order with a purchase unit and payee for each recipient. The donor approves once, PayPal captures each payment separately, and Giftwise never holds the money.
4. **A public receipt.** Every payee with its PayPal capture ID, the rules that applied, a live "Check with PayPal now" button, and a hash-chained ledger anyone can verify.

## How this works for real

The demo runs in PayPal's sandbox. Here is what changes when real money moves. The same answers, with their sources, are on every gift page and at [`/about#real`](https://giftwise-405i.onrender.com/about#real).

- **Every shop needs a PayPal business account**, because PayPal pays the shop directly. Giftwise would onboard each shop with PayPal's [Partner Referrals API](https://developer.paypal.com/docs/multiparty/seller-onboarding/before-payment/): the shop signs up or links its account in PayPal's own flow, PayPal returns its `merchantIdInPayPal`, and each order sets `payee.merchant_id` in place of the sandbox email ([pay another account](https://developer.paypal.com/docs/checkout/standard/customize/pay-another-account/)).
- **A shop without PayPal** can still be paid in a way that keeps the check whole. Gifts can go to the person's ABLE account for any [qualified disability expense](https://www.irs.gov/newsroom/able-accounts-can-help-people-with-disabilities-pay-for-disability-related-expenses) (housing, education, transportation, health, assistive technology and more). Organizations can also pay with Payouts, which emails the shop a claim link. An unclaimed payout [returns to the sender after 30 days](https://developer.paypal.com/docs/payouts/standard/reference/payment-processing/), never to the person.
- **ABLE gifts go through the plan's own gift page.** ABLEnow and IAble use [Ugift codes](https://www.iable.gov/resources/give-a-gift), paid by bank transfer or check. [STABLE](https://stableaccount.com/benefits/gifting), [CalABLE](https://calable.ca.gov/how-it-works/gifting) and [ABLE United](https://www.ableunited.com/usage/gifting) give each account its own gift link. In the demo the ABLE account is a sandbox PayPal account; for real, Giftwise works out the ABLE amount the same way and sends the giver to the plan's page for that part.
- **Timing matters for rent help.** STABLE and CalABLE hold gifts made through a gift page for 10 business days before they can be withdrawn. Housing money taken out of an ABLE account should be spent that month ([POMS SI 01130.740](https://secure.ssa.gov/poms.nsf/lnx/0501130740)), so rent help through ABLE works best about two weeks before the bill is due.
- **Fees:** US buyers pay [no PayPal fee](https://www.paypal.com/us/digital-wallet/paypal-consumer-fees) when no currency conversion is involved, and the shop pays PayPal's usual [merchant fee](https://www.paypal.com/us/business/paypal-business-fees). The demo adds nothing on top. On PayPal's partner program, a platform fee can be set per order (`payment_instruction.platform_fees`, shown to the shop as partner commissions), so Giftwise could cover its costs without charging the giver or the person on SSI ([multiparty](https://developer.paypal.com/docs/multiparty/)).

## What is inside

- **PayPal:** Orders v2 with several payees in one order, the JavaScript SDK v6 button, server-side capture with `PayPal-Request-Id` idempotency, approval links that capture on return, Payouts batches for organizations, Transaction Search and the Balances API for reconciliation, signature-verified webhooks as a safety net, live order lookups, and sandbox negative testing for declined cards.
- **Checked every night, from outside, on Render Workflows:** `workflows/` is a Render Workflow that fans out one task per check, in parallel with retries: each failure case against the PayPal sandbox, each page on the judges' path, and each public API promise (22 in all). A Render cron job starts it nightly; **Run the checks now** on `/judges` starts it on demand, and the results show there and on `/status`. Running the checks in parallel also surfaced a real race in the audit ledger (two appends at once could fork the hash chain); appends now take a Postgres advisory lock, and `npm run test:ledger-race` fires 60 at once to prove it.
- **Eight failure cases, run live** on `/judges`: declined card, double click, unapproved payment, a browser changing the amount or payee, a gift that would lower her check, an AI reviewer that gets the rule wrong, an edited ledger entry, and refunds.
- **Claude (`claude-opus-5-5`):** reads bills, quotes and fundraiser pages into structured data. The rules engine, not the model, decides where the money goes.
- **Two reviewers, two rulebooks:** when a bill might be a housing cost, one Claude reviewer reads only the regulations and the Federal Register, the other only SSA's operating manual. Each must quote its rulebook word for word and a program checks every quote. Giftwise takes a reading only when both checked answers agree; otherwise it uses the route that keeps the check whole under either reading. Measured on 20 labeled bills: every clear case right, all 40 quotes found word for word, and the check kept whole in all 20 (results on `/judges`).
- **Fundraiser to gift page:** paste a fundraiser link and Giftwise makes a live gift page where every stated use is paid straight to the shop or the ABLE account, with the pronouns the organizer chooses.
- **The report to Social Security:** people on SSI must tell SSA about changes in income, including help from family, within 10 days after the month ends (20 CFR 416.714). `/g/maya/report` writes that report from the gifts: which ones to tell SSA about, the check each month decides, a call script, and for every other gift the rule that says it is not income and the PayPal capture or payout that proves where the money went. Press **As cash** to see the report the same gifts would have needed. Also as CSV, at `GET /api/v1/ssa-report`, and as an MCP tool.
- **For AI agents:** an MCP server at `/api/mcp` with six tools. An assistant can check a gift, read a gift page, plan a gift, ask the two reviewers, write the month's report to Social Security, and start a PayPal checkout that only the giver can approve; Giftwise captures when PayPal sends the giver back. `/agents` shows a Claude assistant doing exactly that, and runs it live.
- **Maya's year, in AG Studio:** `/dashboard` shows every gift and her check each month with Giftwise and as cash, themed from the site tokens in light and dark. A custom Giftwise widget runs the rules engine on whatever the filters leave in view. In edit mode, AG Studio's own agents run on Claude through our adapter (AG Studio ships none for Claude), and can call the rules engine to answer what-if questions such as "what if that rent help had been cash?"
- **For organizations:** `/organizations` lets a fund that already holds money for families (a disability foundation, a mutual-aid fund, a church) pay many households' needs in one PayPal Payouts batch. The rules engine routes each grant, every item goes straight to the shop or the ABLE account, and Transaction Search confirms each payout in PayPal's own report.
- **Developer API:** free sandbox keys stored only as hashes, rate limits, OpenAPI 3.1 at `/openapi.json`, docs and a live playground at `/developers`.
- **Design:** light and dark themes, phone and desktop, an Info button on every element, and WCAG 2.2 AA checked with axe.

Built with Next.js 16, React 19, TypeScript, Postgres 17, Drizzle and AG Studio 3.0, hosted on Render.

## Run it yourself

```bash
npm install
docker compose up -d          # Postgres 17
cp .env.example .env.local    # add your PayPal sandbox and Anthropic keys
npm run db:push
npm run dev -- -p 3100        # http://localhost:3100
```

[TESTING.md](TESTING.md) explains every variable, the sandbox accounts and the test suites. `npm run checks:local` runs the same 22 outside checks as the nightly Render Workflow against your local copy.

To host your own copy, [`render.yaml`](render.yaml) creates the web service, its database, the `giftwise-checks` Render Workflow and the nightly cron job on Render. Give the web service and the cron job a Render API key (`RENDER_API_KEY`) so they can start the workflow:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/usv240/giftwise)

## Tests

| Suite | Command | Result |
|---|---|---|
| Rules engine, routing, the SSA report, the checks workflow and the cited answers | `npm test` | 61 of 61 |
| API end to end | `npm run e2e:api` | 84 of 84 |
| Browser end to end | `npm run e2e:ui` | 57 of 57 |
| Accessibility, 19 pages in light and dark, phone and desktop | `npm run e2e:a11y` | 76 of 76 page views |
| Real PayPal checkout as the sandbox buyer | `npm run e2e:paypal` | 14 of 14 |
| An agent starts a checkout over MCP, the buyer approves the link | `npm run e2e:agent` | 5 of 5 |
| Failure cases against the PayPal sandbox | `/judges` | 8 of 8 |
| Outside checks, as the nightly Render Workflow runs them | `npm run checks:local` | 22 of 22 |
| 60 ledger appends at once keep the hash chain whole | `npm run test:ledger-race` | Chain verifies |

Set `BASE_URL` to run the end-to-end suites against a deployed copy.

## Sources and credits

Every rule cites the regulation or SSA's operating manual (POMS). Photographs and video come from open collections and are credited in [`public/images/credits.json`](public/images/credits.json) and [`public/media/credits.json`](public/media/credits.json). Maya, her family and the shops are fictional.

## License

[MIT](LICENSE)
