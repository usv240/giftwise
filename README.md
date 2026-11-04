# Giftwise

Benefit-safe giving for people on SSI. Family and friends give through PayPal, and Giftwise pays the shop, the clinic or the person's ABLE account directly, so the monthly check stays whole.

- **Live demo:** [giftwise-405i.onrender.com](https://giftwise-405i.onrender.com) (PayPal sandbox, no Giftwise login needed)
- **For judges:** start at [`/judges`](https://giftwise-405i.onrender.com/judges). The sandbox buyer login and step-by-step checks are in [TESTING.md](TESTING.md).
- **Demo video:** [youtu.be/1JLuiRZkkUI](https://youtu.be/1JLuiRZkkUI)

## The problem in one number

About 7.3 million people receive SSI (September 2026). SSI counts cash gifts as income. Give Maya $1,000 in cash and, two months later, her $994 check drops to $74. Pay the shop for something she needs and the same $1,000 leaves her check at $994. Giftwise does that routing for every gift, with the rule and its source shown each time ([20 CFR 416.1121](https://www.ecfr.gov/current/title-20/chapter-III/part-416/subpart-K/section-416.1121), [POMS SI 00830.520](https://secure.ssa.gov/poms.nsf/lnx/0500830520)).

## Results

- **40 of 40 of Social Security's own worked examples** from its operating manual match SSA's answer. Claude with no rulebook, asked the same questions: 32 of 40.
- **14 of 14 real SSI cases from federal courts** reach the outcome SSA and the court did. In the 4 where the facts allow a benefit-safe route, the same help routed through Giftwise keeps **$1,656.66 a month** at 2026 rates. The run found a real gap in the rules engine, now fixed.
- **0 of 59 labeled bills** where Giftwise accepted a route that would lower the check. Claude with no rulebook accepted 3.

All three are on [`/judges`](https://giftwise-405i.onrender.com/judges), case by case, with the sources.

## See it

| Give any amount: one PayPal checkout pays five recipients | The same October gifts, as cash: the report she would have needed |
|---|---|
| ![Maya's gift page: $1,500 split across four needs and her ABLE account; as cash $0, with Giftwise $994](docs/img/2-give-any-amount.png) | ![Maya's October report as cash: 5 gifts to tell Social Security about, $538 counted, December check $456](docs/img/4-report-as-cash.png) |
| **Her benefit calendar: move a cash gift five days and a different check drops** | **Checked against Social Security's own worked examples** |
| ![Bryntum calendar of October in the as-cash view, with the move of Aunt June's $150 and the checks it changed](docs/img/5-benefit-calendar.png) | ![Social Security's own worked examples: the rules engine against Claude with no rulebook](docs/img/6-ssa-examples.png) |
| **Her own copy, in Easy Read and Spanish** | **Give every month: the rules route it again, and say why** |
| ![Maya's October report in Spanish Easy Read: no call needed, her December check stays $994, each gift in one sentence with a picture](docs/img/8-easy-read-spanish.png) | ![A monthly gift of $300: November paid the wheelchair repair; December finished it with $120 and sent $180 to the laptop, with the reason for each change](docs/img/10-monthly.png) |
| **The results, first thing on the judges' page** | **Real SSI cases from federal courts** |
| ![40 of 40 SSA worked examples; 14 of 14 federal court cases; 0 of 59 wrong routes accepted](docs/img/7-results.png) | ![14 of 14 federal court cases reach SSA's and the court's outcome; the gap the run found, now fixed](docs/img/9-field-cases.png) |

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

- **PayPal:** Orders v2 with several payees in one order, the JavaScript SDK v6 button, server-side capture with `PayPal-Request-Id` idempotency, approval links that capture on return, Payouts batches for organizations, Transaction Search and the Balances API for reconciliation, signature-verified webhooks as a safety net, live order lookups, sandbox negative testing for declined cards, and PayPal's own MCP server (the `@paypal/mcp` package, which Giftwise runs; PayPal's hosted server is the second choice while its tool calls fail on PayPal's side, [AI-Toolkit issue 34](https://github.com/paypal/AI-Toolkit/issues/34)). All 13 PayPal APIs and tools are listed on [`/stack`](https://giftwise-405i.onrender.com/stack#paypal-apis) with the job each one does.
- **Checked every night, from outside, on Render Workflows:** `workflows/` is a Render Workflow that fans out one task per check, in parallel with retries: each failure case against the PayPal sandbox, each page on the judges' path, and each public API promise (23 in all). A Render cron job starts it nightly; **Run the checks now** on `/judges` starts it on demand, and the results show there and on `/status`. Running the checks in parallel also surfaced a real race in the audit ledger (two appends at once could fork the hash chain); appends now take a Postgres advisory lock, and `npm run test:ledger-race` fires 60 at once to prove it. The same checks later caught a second race: two captures of one order at the same moment get a 500 from PayPal's sandbox on the second request, and the old code took that as final and marked the order failed over the first one's capture. Captures now retry a 5xx with the same `PayPal-Request-Id`, only the call that records a capture counts it toward the need, and a failure never overwrites a capture.
- **Eight failure cases, run live** on `/judges`: declined card, double click, unapproved payment, a browser changing the amount or payee, a gift that would lower her check, an AI reviewer that gets the rule wrong, an edited ledger entry, and refunds.
- **Claude (`claude-opus-5-5`):** reads bills, quotes and fundraiser pages into structured data. The rules engine, not the model, decides where the money goes.
- **Two reviewers, two rulebooks:** when a bill might be a housing cost, one Claude reviewer reads only the regulations and the Federal Register, the other only SSA's operating manual. Each must quote its rulebook word for word and a program checks every quote. Giftwise takes a reading only when both checked answers agree; otherwise it uses the route that keeps the check whole under either reading. Measured on 59 bills labeled from the rule text (20 plus 39 harder ones: internet, renter's insurance, HOA fees, bundled bills, a utility deposit): the referee and the manual reviewer accepted 0 routes that would lower the check, the regulations reviewer 1, and Claude with no rulebook 3; all 118 quotes were found word for word. On this run the second reviewer adds no measurable gain over the manual reviewer alone, and the referee's cost is that it leaves more bills unsettled (9, sent to the safe route). What it is for, measured on the same bills: if one reviewer is wrong, trusting it alone keeps her check whole on 28 of 59; with both reviewers and the referee, 59 of 59 (results on `/judges`).
- **Checked against Social Security's own examples:** 40 worked examples from SSA's operating manual and regulations, each with SSA's answer quoted word for word. The rules engine matches all 40. Claude alone, with no rulebook, matches 32: it misses the $60 one-off exclusion six times and housing support twice. Growing the set from 13 to 40 found two real gaps, now fixed: the $60 exclusion applies in order of receipt and before the housing cap, and a prepaid housing bill counts in the months it covers. `npm run eval:ssa` reruns it.
- **Real cases, from federal courts:** 36 SSI cases from GovInfo's public-domain court opinions where SSA counted help from family or friends (14 scored; the rest turn on loans, shared rent or trusts, listed with the reason). The engine reaches the outcome SSA and the court did in all 14; routed through Giftwise, the same help keeps $1,656.66 a month at 2026 rates in the 4 cases whose facts allow it. The run found a real gap: since 2024 the one-third reduction applies only when the household provides all meals (20 CFR 416.1131(a)(3)); now fixed. `npx tsx scripts/run-field-cases.ts` reruns it. Fundraiser pages were not used, because GoFundMe's and Givebutter's terms rule out automated reading.
- **Give every month:** after a gift, **Give this every month** keeps the same amount going. Each month the rules route it again for that month's needs: a recurring need like the electric bill opens again, a paid-off need drops away, and the giver's page at `/m/{link}` shows what changed and why before they approve that month in PayPal. Giftwise keeps no payment method: in PayPal's sandbox a wallet saved with Vault can pay only the platform's own account (a `vault_id` charge to another payee returns `BILLING_AGREEMENT_NOT_FOUND`), so an automatic charge would mean Giftwise holding the money. Signed in to PayPal, approving a month takes two clicks. `npm run e2e:monthly` runs two months end to end in the sandbox.
- **Fundraiser to gift page:** paste a fundraiser link and Giftwise makes a live gift page where every stated use is paid straight to the shop or the ABLE account, with the pronouns the organizer chooses.
- **The report to Social Security:** people on SSI must tell SSA about changes in income, including help from family, within 10 days after the month ends (20 CFR 416.714). `/g/maya/report` writes that report from the gifts: which ones to tell SSA about, the check each month decides, a call script, and for every other gift the rule that says it is not income and the PayPal capture or payout that proves where the money went. Press **As cash** to see the report the same gifts would have needed. Also as CSV, at `GET /api/v1/ssa-report`, and as an MCP tool.
- **Her own copy, in Easy Read and Spanish:** the person on SSI is the one who must report, so `/g/maya/report/easy` writes the same report to her: the answer first, then one idea per line with a picture beside each, what to do, and what to say on the call, in English or Spanish (`?lang=es`). It follows the Autistic Self Advocacy Network's Easy Read guide, [One Idea Per Line](https://autisticadvocacy.org/wp-content/uploads/2021/07/One-Idea-Per-Line.pdf); every sentence comes from the same rules output as the full report, no model writes or translates it, and a test holds every sentence to 15 words or fewer in both languages. **Listen** reads it aloud in either language with the browser's own voice, and **Remind me by the 10th** downloads a calendar file with the due date and a monthly look on the 5th. About 851,000 people on SSI under 65 have an intellectual disability ([SSA, December 2024](https://www.ssa.gov/policy/docs/statcomps/ssi_asr/2024/sect06.html)).
- **For AI agents:** an MCP server at `/api/mcp` with seven tools. An assistant can check a gift, read a gift page, plan a gift, ask the two reviewers, write the month's report to Social Security (also in Easy Read or Spanish for the person), set up a monthly gift, and start a PayPal checkout that only the giver can approve; Giftwise captures when PayPal sends the giver back. `/agents` shows a Claude assistant doing exactly that, and runs it live. After it starts the checkout, the assistant reads the order from PayPal itself: it asks PayPal's own MCP server (`get_order`) and reads PayPal's Orders API when that server cannot run the call, so the giver hears PayPal's record, not only Giftwise's. Add Giftwise to Claude, Claude Code, Cursor or VS Code from `/agents`; [`server.json`](server.json) describes it for the MCP Registry.
- **Her benefit calendar, in Bryntum:** `/g/maya/calendar` puts every gift on the day it arrived, each report to Social Security on the 10th, and each check on the 1st, in light and dark. SSI counts income by calendar month and gives the $60 exclusion once a quarter, so the day matters: press **As cash**, drag Aunt June's $150 from October 28 to November 2, and the calendar shows her December check rising from $456 to $606 while January's drops from $994 to $864. A form does the same move without dragging.
- **Maya's year, in AG Studio:** `/dashboard` shows every gift and her check each month with Giftwise and as cash, themed from the site tokens in light and dark. A custom Giftwise widget runs the rules engine on whatever the filters leave in view. In edit mode, AG Studio's own agents run on Claude through our adapter (AG Studio ships none for Claude), and can call the rules engine to answer what-if questions such as "what if that rent help had been cash?"
- **For organizations:** `/organizations` lets a fund that already holds money for families (a disability foundation, a mutual-aid fund, a church) pay many households' needs in one PayPal Payouts batch. The rules engine routes each grant, every item goes straight to the shop or the ABLE account, and Transaction Search confirms each payout in PayPal's own report.
- **Developer API:** free sandbox keys stored only as hashes, rate limits, OpenAPI 3.1 at `/openapi.json`, docs and a live playground at `/developers`.
- **The rules engine as a package:** [`packages/ssi-gift-rules`](packages/ssi-gift-rules) builds the same engine into a dependency-free npm package with ESM, CommonJS and types, and its test checks the build gives the same answer as the published results on every SSA worked example.
- **Design:** light and dark themes, phone and desktop, an Info button on every element, and WCAG 2.2 AA checked with axe.

Built with Next.js 16, React 19, TypeScript, Postgres 17, Drizzle, AG Studio 3.0 and Bryntum Calendar 7.3, hosted on Render.

## Run it yourself

```bash
npm install
docker compose up -d          # Postgres 17
cp .env.example .env.local    # add your PayPal sandbox and Anthropic keys
npm run db:push
npm run dev -- -p 3100        # http://localhost:3100
```

[TESTING.md](TESTING.md) explains every variable, the sandbox accounts and the test suites. `npm run checks:local` runs the same 23 outside checks as the nightly Render Workflow against your local copy.

To host your own copy, [`render.yaml`](render.yaml) creates the web service, its database, the `giftwise-checks` Render Workflow and the nightly cron job on Render. Give the web service and the cron job a Render API key (`RENDER_API_KEY`) so they can start the workflow:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/usv240/giftwise)

## Tests

| Suite | Command | Result |
|---|---|---|
| Rules engine, routing, monthly gifts, the SSA report and its Easy Read version, the checks workflow and the cited answers | `npm test` | 83 of 83 |
| Social Security's own worked examples (rules engine, and Claude alone as the baseline) | `npm run eval:ssa` | 40 of 40 (Claude alone 32 of 40) |
| Real SSI cases from federal courts | `npx tsx scripts/run-field-cases.ts` | 14 of 14 |
| 59 labeled bills: wrong routes accepted (referee; Claude with no rulebook) | `npx tsx --env-file=.env.local scripts/run-eval.ts` | 0 (3) |
| API end to end | `npm run e2e:api` | 85 of 85 |
| Browser end to end | `npm run e2e:ui` | 58 of 58 |
| Accessibility, 23 pages in light and dark, phone and desktop | `npm run e2e:a11y` | 92 of 92 page views |
| Real PayPal checkout as the sandbox buyer | `npm run e2e:paypal` | 14 of 14 |
| A monthly gift, two months, as the sandbox buyer | `npm run e2e:monthly` | 8 of 8 |
| An agent starts a checkout over MCP, the buyer approves the link | `npm run e2e:agent` | 5 of 5 |
| Failure cases against the PayPal sandbox | `/judges` | 8 of 8 |
| Outside checks, as the nightly Render Workflow runs them | `npm run checks:local` | 23 of 23 |
| 60 ledger appends at once keep the hash chain whole | `npm run test:ledger-race` | Chain verifies |

Set `BASE_URL` to run the end-to-end suites against a deployed copy.

## Sources and credits

Every rule cites the regulation or SSA's operating manual (POMS). Photographs and video come from open collections and are credited in [`public/images/credits.json`](public/images/credits.json) and [`public/media/credits.json`](public/media/credits.json). Maya, her family and the shops are fictional.

## License

[MIT](LICENSE)
