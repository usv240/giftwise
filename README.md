# Giftwise

Benefit-safe giving for people on SSI, their families and their benefits counselors. Family and friends give through PayPal, which pays the shops and clinics directly; the share for the person's ABLE account goes through the ABLE plan's own gift page. The monthly check stays whole.

- **Live:** [giftwise-405i.onrender.com](https://giftwise-405i.onrender.com), PayPal sandbox, no login. Start at [`/evidence`](https://giftwise-405i.onrender.com/evidence): one result line, the five-minute path, every result. The sandbox buyer login is in [TESTING.md](TESTING.md).
- **Claims to evidence:** [docs/evidence-index.md](docs/evidence-index.md): ten claims, each with the live page, the file and line, and the test.

## Run it yourself

```bash
npm install
docker compose up -d          # Postgres 17
cp .env.example .env.local    # PayPal sandbox keys, payee accounts, ANTHROPIC_API_KEY, DATABASE_URL (TESTING.md names each)
npm run db:push               # create the tables; Maya's sample page is seeded the first time /g/maya opens
npm run dev -- -p 3100        # http://localhost:3100
npm test                      # a fresh clone with no .env.local: 300 pass and 6 skip (6 need a database); when .env.local names a reachable database: 306 of 306, no keys needed
```

`npm test` needs no keys: tests that need Postgres skip with the reason in their names; no test calls Claude or PayPal. [TESTING.md](TESTING.md) explains every variable and suite; `npm run checks:local` runs the same 25 outside checks as the nightly Render Workflow ([`render.yaml`](render.yaml)).

[![CI](https://github.com/usv240/giftwise/actions/workflows/ci.yml/badge.svg)](https://github.com/usv240/giftwise/actions/workflows/ci.yml) on every push: audit, types, lint, unit tests, 20,000 fresh random gifts, the `ssi-gift-rules` package, and a production build with no keys where every page must answer and pass axe.

## Results

| **$331 to $663 a month** | **40 of 40** | **0 of 55** |
|---|---|---|
| help from family was counted against the person in all 14 real SSI court cases; routed through Giftwise, the same help keeps this in 4 of the 14 as the opinions state the facts, and keeps money in all 10 with stated amounts if the person can open an ABLE account; two families, **$38,103.32** over the 41 and 37 months their cases cover: the engine's counterfactual, not an observed outcome ([`/evidence/impact#kept`](https://giftwise-405i.onrender.com/evidence/impact#kept)) | of Social Security's own worked examples match SSA's answer; Claude with no rulebook, 32 of 40 ([`/evidence/ssa-examples`](https://giftwise-405i.onrender.com/evidence/ssa-examples)) | gifts that would lower the check were let through, over every case whose right answer is known ([`/evidence/rules#errors`](https://giftwise-405i.onrender.com/evidence/rules#errors)) |

- **4 of 5 examples the engine never saw**, from SSA's manual, run once on the engine frozen at commit `3f3ea60`; the one that differs is a gift certificate SSA does not count. The first run matched 1 of 5; two expected answers were then corrected to SSA's text, each with its reason in `content/eval/held-out.json`.
- **1 of 5 in a second set written before its run** (`content/eval/held-out-2.json`, git blob `715607f`, engine frozen at `c5e94eb`); the others name three rules to add ([docs/results.md](docs/results.md)).
- **14 of 14 real SSI cases from federal courts** reach the outcome SSA and the court did.
- **59 of 59 labeled bills** routed so the check stays whole, 52 clear and 7 contested; Claude with no rulebook, 56 of 59; each reviewer alone, 59 and 58 of 59.
- **100,000 random gifts, every promise kept**: every cent placed, her check whole, ABLE within its limit.
- **6 of 51** fine gifts sent another way, each with her check whole (`src/lib/error-rates.ts`).
- **The ABLE share, for real.** PayPal carries 56 percent of the sample year's dollars today: $3,519 of $6,328, everything paid to shops and clinics. The ABLE share goes through the plan's own gift page (a Ugift code or gifting link); in the sandbox a PayPal test account stands in, and [`/g/maya`](https://giftwise-405i.onrender.com/g/maya) and every receipt with an ABLE line show the hand-off ([docs/real-world.md](docs/real-world.md)).

Case by case: [docs/results.md](docs/results.md), [`/evidence/rules`](https://giftwise-405i.onrender.com/evidence/rules).

## Where to look

| | Open | Then run |
|---|---|---|
| What it uses and how | [`src/lib/paypal/gift-order.ts`](src/lib/paypal/gift-order.ts), one order with a payee per purchase unit; [`src/lib/paypal/capture.ts`](src/lib/paypal/capture.ts), captured once under one `PayPal-Request-Id` | `npm run e2e:api`, 99 of 99; `npm run e2e:paypal`, 14 of 14 (sandbox keys), each with a redacted transcript of every order and capture ([`/evidence/operations#transcripts`](https://giftwise-405i.onrender.com/evidence/operations#transcripts)) |
| A complete product | [`/g/maya`](https://giftwise-405i.onrender.com/g/maya) to [the month's report](https://giftwise-405i.onrender.com/g/maya/report?month=2026-10); the [organizer's page](https://giftwise-405i.onrender.com/manage/maya-sample-organizer) | `npm run e2e:ui`, 65 of 65 (Claude's four document steps run live with a key and on its recorded answers without one, and skip only when the server has no AI key and no recorded answers); `npm run e2e:a11y`, 140 of 140 page views |
| Who it helps and the evidence | [`src/lib/impact.ts`](src/lib/impact.ts) and [`src/lib/research.ts`](src/lib/research.ts); [`/evidence/impact`](https://giftwise-405i.onrender.com/evidence/impact) | `tests/docs-numbers.test.ts`; `tests/research.test.ts` |
| What is new | [`src/lib/review/referee.ts`](src/lib/review/referee.ts), [`src/lib/report/verify.ts`](src/lib/report/verify.ts); [`/evidence/impact#compare`](https://giftwise-405i.onrender.com/evidence/impact#compare) | `tests/referee.test.ts`; `tests/verify.test.ts` |

## PayPal and AI, file by file

| | Here | File |
|---|---|---|
| Orders v2 | One order, a purchase unit and payee per recipient, up to 10; payees come from the server. Real shops are paid by `payee.merchant_id` after Partner Referrals onboarding, which PayPal opens to approved partners (sandbox: 403, [docs/real-world.md](docs/real-world.md)) | `src/lib/paypal/gift-order.ts`, `src/lib/paypal/orders.ts` |
| JavaScript SDK v6 | The PayPal button on each need and on Give any amount, and the guest card button | `src/components/gift/PayPalPay.tsx` |
| Capture | Server side, once, under one `PayPal-Request-Id`; a 5xx retried with the same id | `src/lib/paypal/capture.ts` |
| Approval links | An assistant or a monthly gift starts an order; only the giver approves; Giftwise captures on return | `src/lib/paypal/gift-order.ts`, `src/app/api/paypal/return/` |
| Payouts, Transaction Search, Balances | A fund pays many households' needs in one batch, each payout confirmed in PayPal's report | `src/lib/paypal/payouts.ts`, `src/lib/paypal/reporting.ts` |
| Webhooks | Captures a payment the giver never returned for, after checking PayPal's signature | `src/app/api/paypal/webhook/route.ts` |
| PayPal MCP server | The assistant reads each checkout back through `get_order`; Giftwise's MCP server at `/api/mcp`, with nine tools, lets it start a checkout only the giver can approve | `src/lib/agent/paypal-mcp.ts`, `src/lib/mcp/tools.ts` |
| Claude | Reads bills and fundraiser pages into checked data, acts as two reviewers over two rulebooks; it never decides money. With no key or the budget spent, the samples replay its recorded answers through the same code, labelled Replayed | `src/lib/ai/tasks.ts`, `src/lib/ai/bill-review.ts`, `src/lib/ai/claude.ts` (`content/ai-replay`), `src/lib/rules/engine.ts` |
| AG Studio | Maya's year as a dashboard; a widget reruns the rules | `src/components/dashboard/FamilyStudio.tsx` |
| Bryntum Calendar | Her benefit calendar; dragging a gift reruns the rules | `src/components/calendar/BenefitCalendar.tsx` |
| Channel3 | The gift finder: real products, each checked against the rules | `src/lib/channel3.ts` |
| Elasticsearch | Ask the rulebook: hybrid retrieval; Claude answers only from the passages | `src/lib/rulebook.ts` |
| Postman | The API as a collection, 16 requests with tests, run with Newman | `postman/giftwise.postman_collection.json` |
| Zapier | A signed `gift.received` event to the organizer's webhook on every capture | `src/lib/manage.ts` |
| Render Workflows | 25 outside checks nightly, monthly gifts planned on the 1st, the rulebook index weekly | `workflows/src/checks.ts`, `workflows/src/main.ts` |

Every commit is from November 2026 (`git log --date=short`).

## What it changes, in dollars

- In the two real court cases whose opinions state how long the help lasted, the same help routed through Giftwise would have kept one family $13,584.53 over 41 months and another $24,518.79 over 37 months, $38,103.32 in all, at 2026 rates. The rules engine's counterfactual on each case's own facts: what it keeps each month ($331.33 and $662.67), repriced at 2026 rates, times the months the opinion states.
- In Maya's sample year, one shared page keeps $1,747.33 that 10 of her monthly checks would lose with each giver paying on their own.
- Paying a shop, a clinic or a school keeps the check whole for all 7.4 million people on SSI (January 2025, [CRS IF10482](https://www.congress.gov/crs-product/IF10482)). Rent and utilities stay whole through an ABLE account, open where blindness or a disability began before 46 ([POMS SI 01130.740](https://secure.ssa.gov/poms.nsf/lnx/0501130740)): all 1.0 million children on SSI, and the adults whose condition began before 46. Without ABLE, $800 of rent paid by family in November 2026 leaves her January 2027 check at $686 of $1,029, and through ABLE it stays $1,029 (`housingReach()` in [`src/lib/impact.ts`](src/lib/impact.ts)).

Each figure is computed by [`src/lib/impact.ts`](src/lib/impact.ts), the code the site uses, and `tests/docs-numbers.test.ts` holds this file to it: [docs/results.md](docs/results.md), [docs/real-world.md](docs/real-world.md), [`/evidence/impact`](https://giftwise-405i.onrender.com/evidence/impact).

## What is at stake

SSI counts cash gifts as income, and a gift sets the check paid two months later, at that year's federal amount: $994 in 2026, $1,029 from January 2027. Give Maya $1,000 in cash in November 2026 and her January 2027 check drops from $1,029 to $109. Pay the shop for something she needs and the same $1,000 leaves that January 2027 check at $1,029 ([20 CFR 416.1121](https://www.ecfr.gov/current/title-20/chapter-III/part-416/subpart-K/section-416.1121), [POMS SI 00830.520](https://secure.ssa.gov/poms.nsf/lnx/0500830520)).

Measured by the agency itself ([`/evidence/impact#stake`](https://giftwise-405i.onrender.com/evidence/impact#stake); `src/lib/research.ts`, `tests/research.test.ts`):

- **454,843** people on SSI had their check lowered in December 2024 for shelter someone else helped with, by $247 a month on average; in January 2022, 793,000 ([SSI Annual Statistical Report 2024](https://www.ssa.gov/policy/docs/statcomps/ssi_asr/2024/sect02.html), Tables 8 and 12; [88 FR 9779](https://www.govinfo.gov/content/pkg/FR-2023-02-15/html/2023-02731.htm)).
- **8.59 percent** of SSI improper payments in fiscal years 2020 through 2024 came from in-kind support, $1.5 billion paid too much and $1.3 billion too little; SSA calls self-reporting its primary tool for learning of changes ([FY 2025 Agency Financial Report](https://www.ssa.gov/finance/2025/Other%20Reporting%20Requirements.pdf), pages 184 and 186). SSA told its Inspector General it has no tools to identify living arrangement errors ([OIG 152601](https://oig.ssa.gov/~assets/uploads/152601.pdf), July 2026), and attributed 9 percent of the SSI overpayments assessed in 2020 through 2023 to unreported living arrangements or in-kind support ([OIG 062405](https://oig.ssa.gov/~assets/uploads/062405.pdf), February 2025).
- **$132 a month** is SSA's own pricing of housing help from others, the average rise it projected for about 41,000 people under its 2024 rental subsidy rule ([89 FR 25507](https://www.govinfo.gov/content/pkg/FR-2024-04-11/html/2024-07675.htm)); the food rule it priced at $1.6 billion over ten years ([89 FR 21199](https://www.govinfo.gov/content/pkg/FR-2024-03-27/html/2024-06464.htm)).
- **83,110** people had payments suspended in 2024 for savings over a $2,000 limit unchanged since 1989, and 45,146 had them ended ([SSI Annual Statistical Report 2024](https://www.ssa.gov/policy/docs/statcomps/ssi_asr/2024/sect11.html), Tables 76 and 77; [POMS SI 01110.003](https://secure.ssa.gov/poms.nsf/lnx/0501110003)). **263,000** ABLE accounts held $3.6 billion on June 30, 2026, against roughly 14 million people who can open one since the age limit rose to 46 ([ISS Market Intelligence](https://www.529conference.com/2q-2026-529-and-able-market-sizing-highlights/); [POMS SI 01130.740](https://secure.ssa.gov/poms.nsf/lnx/0501130740)).
- **10 percent** of the check is the rate at which an SSI overpayment is recovered ([EM-25029 REV](https://secure.ssa.gov/apps10/reference.nsf/links/08282025031929PM)), so the $4,870.00 and $11,442.20 asked back in two court cases would take 49 and 116 months to repay.

## Design

Two audiences: the giver, on a phone, with the total and payees beside the PayPal button and amounts typed as people write them ("$50", "1,000"); and the organizer, who lists the needs. The person on SSI gets her report in Easy Read and Spanish (`tests/easy-read.test.ts`, `tests/gift-es.test.ts`). 140 of 140 page views pass axe (WCAG 2.2 AA) at phone and desktop width, light and dark. Light is the default; dark, Large text and Plain or Technical explanations are one tap away ([`/evidence`](https://giftwise-405i.onrender.com/evidence#design), [docs/inside.md](docs/inside.md)).

## What is first here

Of the products compared on [`/evidence/impact#compare`](https://giftwise-405i.onrender.com/evidence/impact#compare) (True Link, Purple, trusts, ABLE gift pages and more, each from its own dated page), none does these three or publishes accuracy against SSA's own material:

- **A third party's gift is routed by a rules engine built from the statute to the payee before it becomes the person's money**, and one PayPal order pays up to ten payees.
- **A monthly report to Social Security anyone can verify against PayPal's records, with no login.**
- **Two reviewers reading two different rulebooks (20 CFR 416 and POMS), quotes checked by code, and a referee that keeps the check whole under either reading when they disagree.**

## Where the two-reviewer design comes from

It builds on LLM-as-judge (Zheng 2023), model panels (Verga 2024), trust-or-escalate (Jung 2024), learning to defer (Madras 2018) and selective classification (Geifman 2017). New here: each reviewer reads a different rulebook, so independence comes from the text (`src/lib/review/referee.ts`, [`/evidence/rules#lineage`](https://giftwise-405i.onrender.com/evidence/rules#lineage)).

## See it

| One checkout, five recipients | The same gifts, as cash |
|---|---|
| ![Maya's gift page, $1,500 split across four needs and her ABLE account](docs/img/2-give-any-amount.png) | ![Maya's October report as cash, December check $456](docs/img/4-report-as-cash.png) |

## How it works

A family member lists what the person needs and who sells it, or makes the page from a fundraiser link (the sample is `/g/maya`). A donor types one number; the engine splits it across the needs and the ABLE account so none of it counts as income. The donor approves once in PayPal, by login or by card; PayPal captures each payee, and Giftwise never holds the money. The receipt lists every capture and rule, with "Check with PayPal now".

More: [docs/results.md](docs/results.md), [docs/real-world.md](docs/real-world.md) (real money, who it reaches, a first pilot), [docs/inside.md](docs/inside.md) (what the AI never decides, every feature), [docs/tests.md](docs/tests.md).

## Sources and credits

Every rule cites the regulation or POMS. Photographs and video are from open collections, credited in [`public/images/credits.json`](public/images/credits.json) and [`public/media/credits.json`](public/media/credits.json). Maya, her family and the shops are fictional. [MIT license](LICENSE).
