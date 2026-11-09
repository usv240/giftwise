# Tests

Every count below is written to [`content/test-results.json`](../content/test-results.json) by `npm run test:results` after the suites run, and `tests/docs-numbers.test.ts` fails when this page, the README or TESTING.md disagrees with it. Back to the [README](../README.md); step-by-step checks and the sandbox accounts are in [TESTING.md](../TESTING.md).

Every push runs [CI](../.github/workflows/ci.yml): `npm audit` at every severity (0 advisories, dev tools included), types, lint, the unit tests, 20,000 random gifts drawn fresh for each run, the `ssi-gift-rules` package build, then a production build served against an empty Postgres with no service keys, where every page must answer and pass axe on desktop and phone, in light and dark. The suites that move sandbox money need keys and run from a machine that has them.

| Suite | Command | Result |
|---|---|---|
| Rules engine, routing, monthly gifts, the SSA report and its Easy Read version, the checks workflow, the cited answers, the report code, the Spanish rule sentences, manage links and signatures, the gift finder, the rulebook search, the calendar planner, 1,000 random gifts, the AI fallbacks, secrets kept out of every response, the bill reviewers, a receipt surviving a reset, the card check, the amounts givers type ("$50", "1,000"), and the docs examples checked against the real handlers | `npm test` | 306 of 306 when `.env.local` names a reachable database (no keys needed); in a fresh clone with no `.env.local`, 300 pass and 6 skip, each skipped test naming what it needs |
| Social Security's own worked examples (rules engine, and Claude alone as the baseline) | `npm run eval:ssa` | 40 of 40 (Claude alone 32 of 40) |
| Real SSI cases from federal courts | `npx tsx scripts/run-field-cases.ts` | 14 of 14 |
| 59 labeled bills: wrong routes accepted (referee; Claude with no rulebook) | `npx tsx --env-file=.env.local scripts/run-eval.ts` | 0 (3) |
| API end to end, including the report check page, the rulebook, the workflow jobs, discovery documents and security headers | `npm run e2e:api` | 99 of 99 |
| The organizer's side: needs, the gift finder, closing a page, and a signed webhook from a real sandbox capture | `npm run e2e:manage` | 21 of 21 |
| The Postman collection, with Newman | `npm run test:postman` | 20 of 20 assertions over 16 requests |
| Browser end to end, including the Spanish gift page, the guided tour, the calendar planner and the Gift Checker naming the same check as Maya's page (Claude's four document steps run live with a key and on its recorded answers without one, and skip only when the server has no AI key and no recorded answers) | `npm run e2e:ui` | 65 of 65 |
| Accessibility, every public page in light and dark, phone and desktop | `npm run e2e:a11y` | 140 of 140 page views |
| Every page and public endpoint with no service keys, each integration on its fallback, robots.txt and the sitemap | `npm run e2e:smoke` | 72 of 72 |
| Real PayPal checkout as the sandbox buyer | `npm run e2e:paypal` | 14 of 14 |
| A monthly gift, two months, as the sandbox buyer | `npm run e2e:monthly` | 8 of 8 |
| An agent starts a checkout over MCP, the buyer approves the link | `npm run e2e:agent` | 5 of 5 |
| Failure cases against the PayPal sandbox | `/evidence/operations` | 8 of 8 |
| Outside checks, as the nightly Render Workflow runs them | `npm run checks:local` | 25 of 25 |
| 100,000 random gifts, needs and people | `npx tsx scripts/run-invariants.ts` | 100,000 of 100,000 keep all twelve promises |
| 60 ledger appends at once keep the hash chain whole | `npm run test:ledger-race` | Chain verifies |
| Under load: visitors at once, each a gift check and the gift page, on the deployed site and on a laptop | `npm run test:load` | p50, p95, p99 and the error rate on [`/evidence/operations#load`](https://giftwise-405i.onrender.com/evidence/operations#load) |
| Page length: words, screens at 1440 by 900 and HTML size of the long pages | `npm run measure:pages` | [`content/public/page-measure.json`](../content/public/page-measure.json) |

Set `BASE_URL` to run the end-to-end suites against a deployed copy.
