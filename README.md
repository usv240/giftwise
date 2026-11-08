# Giftwise

[![CI](https://github.com/usv240/giftwise/actions/workflows/ci.yml/badge.svg)](https://github.com/usv240/giftwise/actions/workflows/ci.yml)

Benefit-safe giving for people on SSI, their families and their benefits counselors. Family and friends give through PayPal, and Giftwise pays the shop, the clinic or the person's ABLE account directly, so the monthly check stays whole.

**PayPal is where the rules are enforced.** A deterministic rules engine picks every payee and every amount before money moves, and one PayPal Orders v2 order pays exactly those payees, captured once under one `PayPal-Request-Id`: money can reach only a payee the rules picked. Each month's report to Social Security can then be checked by anyone against PayPal's own records, and when a bill might be a housing cost, a referee in code over two Claude reviewers decides how it is paid.

- **Live demo:** [giftwise-405i.onrender.com](https://giftwise-405i.onrender.com) (PayPal sandbox, no Giftwise login needed)
- **For judges:** start at [`/evidence`](https://giftwise-405i.onrender.com/evidence): three numbers, the five-minute path, and every result in five groups. The sandbox buyer login and step-by-step checks are in [TESTING.md](TESTING.md); a guest can also pay with PayPal's test card.

## What is new

- **A report to Social Security anyone can check.** Each month's report carries a code and a QR code. Opening it rebuilds the report from Giftwise's records, asks PayPal live for every payment in it, and recomputes the audit ledger's hash chain, so a counselor can confirm every gift with no login.
- **Two rulebooks, and a referee in code.** When a bill might be a housing cost, two Claude reviewers read different rulebooks (the regulations, and SSA's operating manual) and must quote them word for word. Code checks every quote, takes a reading only when both agree, and otherwise picks the route that keeps her check whole under either reading: 59 of 59 labeled bills. Each reviewer alone, on the same run, is published beside it.
- **AI agents ask first.** An MCP server at `/api/mcp` with nine tools: an assistant checks a gift before it is given and starts a PayPal checkout only the giver can approve, then reads the order back from PayPal's own MCP server (`get_order`).
- **Claude reads a bill, live.** On the [electric bill example](https://giftwise-405i.onrender.com/try/presets/electric-bill#read-live), **Read this bill live** has Claude read the sample bill on the spot, counted against the site's daily AI budget; the rules engine prices what it read. When the budget is spent or no key is set, the recorded run is shown and labelled.
- **The rules route the money before PayPal moves it.** A giver types one amount; the rules engine splits it across the needs and the ABLE account, and one PayPal checkout pays every shop, clinic and the ABLE account directly, with the check before and after on screen.

## What it changes, in dollars

- **Real court cases, family by family.** In the two real court cases whose opinions state how long the help lasted, the same help routed through Giftwise would have kept one family $13,584.53 over 41 months and another $24,518.79 over 37 months, $38,103.32 in all, at 2026 rates. The rules engine's counterfactual on each case's own facts: what it keeps each month ($331.33 and $662.67), repriced at 2026 rates, times the months the opinion states. In 4 of 14 real court cases, the same help routed through Giftwise would have kept $331 to $663 a month at 2026 rates. Their facts run from 1996 to 2014: three cases at $331.33 a month and one at $662.67.
- **Why not pay the shop yourself?** For one repair, that works, and it is what Giftwise does. Across the sample year, each giver paying alone, rent and utility bills paid straight to the landlord still count, and savings gifts arrive as cash: the engine lowers 10 of her monthly checks, $1,747.33 in all, and leaves 10 months to report to Social Security, against none with one shared page. That page also adds every giver's ABLE deposits toward the $20,000 yearly limit and pays up to 10 recipients in one PayPal order.
- **A year of family help, run for real.** Maya's sample year is 43 gifts, $6,328, and every one keeps her check whole. Outside the sandbox, $3,519 (28 gifts) goes to shops and clinics through PayPal, $2,724 (14 gifts) goes to her ABLE account through the ABLE plan's own gift page, because each plan takes gifts its own way (a gift link or a Ugift code), and $85 is a jacket given as itself.
- **What SSA asked back.** In two of the court cases, SSA asked for money back: $4,870.00 (a cousin's deposits push savings over the limit) and $11,442.20 (children deposit $1,500 to meet a bank's minimum balance). Run through the engine from each case's facts, the same help paid into an ABLE account keeps her savings under $2,000 in every month in both cases. ABLE needs the disability to have begun before age 46, which these opinions do not state.
- **Who it reaches.** Paying a shop, a clinic, a pharmacy or a school keeps the check whole for all 7.4 million people on SSI (January 2025, [CRS IF10482](https://www.congress.gov/crs-product/IF10482)). Rent and utilities stay whole through an ABLE account, which needs blindness or a disability that began before 46 ([POMS SI 01130.740](https://secure.ssa.gov/poms.nsf/lnx/0501130740)): every one of the 1.0 million children on SSI, and the adults whose condition began before 46. Without ABLE, rent from family still lowers the check, by at most the presumed maximum value less $20: $800 of rent paid by family in November 2026 leaves her January 2027 check at $686 of $1,029, and through ABLE it stays $1,029 (`housingReach()` in [`src/lib/impact.ts`](src/lib/impact.ts)). Giftwise shows the lower check before anyone pays.

Each figure is computed from the files in `content/` by [`src/lib/impact.ts`](src/lib/impact.ts), the same code the home page, `/evidence` and `/about` use, or cited to its source; the cases are on [`/evidence/impact`](https://giftwise-405i.onrender.com/evidence/impact), each with its opinion.

## The problem in one number

SSI counts cash gifts as income, and a gift sets the check paid two months later, at that year's federal amount: $994 in 2026, $1,029 from January 2027. Give Maya $1,000 in cash in November 2026 and her January 2027 check drops from $1,029 to $109, the figure the Gift Checker on the home page shows for a gift made today. Pay the shop for something she needs and the same $1,000 leaves that January 2027 check at $1,029. Giftwise does that routing for every gift, with the rule and its source shown each time ([20 CFR 416.1121](https://www.ecfr.gov/current/title-20/chapter-III/part-416/subpart-K/section-416.1121), [POMS SI 00830.520](https://secure.ssa.gov/poms.nsf/lnx/0500830520)). Help from others changes the check for many people: in January 2022 SSA lowered the payment of 793,000 people on SSI for food or housing someone else provided ([88 FR 9779](https://www.govinfo.gov/content/pkg/FR-2023-02-15/html/2023-02731.htm)).

## Results

- **40 of 40 of Social Security's own worked examples** from its operating manual match SSA's answer. Claude with no rulebook, asked the same questions: 32 of 40.
- **4 of 5 examples the engine never saw**, from SSA's manual, run once on the engine frozen at commit `3f3ea60`. The one that differs is an office-supply gift certificate SSA does not count; Giftwise enters every gift card as cash, so it would send the giver to the supplies instead.
- **14 of 14 real SSI cases from federal courts** reach the outcome SSA and the court did.
- **59 of 59 labeled bills** routed so the check stays whole, counting all 59: the 52 with a clear answer and the 7 contested ones. Claude with no rulebook: 56 of the same 59. Each reviewer alone: the manual reviewer 59 of 59 with no wrong routes, the regulations reviewer 58 of 59.
- **100,000 random gifts, every promise kept**: every cent placed, her check exactly as with no gift, ABLE within its yearly limit, at most 10 PayPal recipients, and eight more.
- **The two errors that cost money,** over every case whose right answer is known, so the 7 contested bills count in neither: **0 of 55** gifts that would lower the check were let through as given, and **6 of 51** fine gifts were sent another way, each to her ABLE account with her check whole (`src/lib/error-rates.ts`).

Each result, case by case, is in [docs/results.md](docs/results.md) and on [`/evidence/rules`](https://giftwise-405i.onrender.com/evidence/rules).

## See it

| Give any amount: one PayPal checkout pays five recipients | The same October gifts, as cash: the report she would have needed |
|---|---|
| ![Maya's gift page: $1,500 shown as one bar split across four needs and her ABLE account; her January 2027 check as cash $0, with Giftwise $1,029](docs/img/2-give-any-amount.png) | ![Maya's October report as cash: 5 gifts to tell Social Security about, $538 counted, December check $456](docs/img/4-report-as-cash.png) |
| **Her benefit calendar: move a cash gift five days and a different check drops** | **Checked against Social Security's own worked examples** |
| ![Bryntum calendar of October in the as-cash view, with the move of Aunt June's $150 and the checks it changed](docs/img/5-benefit-calendar.png) | ![Social Security's own worked examples: the rules engine against Claude with no rulebook](docs/img/6-ssa-examples.png) |
| **Her own copy, in Easy Read and Spanish** | **Give every month: the rules route it again, and say why** |
| ![Maya's October report in Spanish Easy Read: no call needed, her December 2026 check stays $994, each gift in one sentence with a picture](docs/img/8-easy-read-spanish.png) | ![A monthly gift of $300: November paid the wheelchair repair; December finished it with $120 and sent $180 to the laptop, with the reason for each change](docs/img/10-monthly.png) |
| **The Evidence page opens with three numbers** | **Real SSI cases from federal courts** |
| ![The Evidence page: $38,103 the same help would have kept two families in real court cases, 40 of 40 of SSA's worked examples, and 0 of 55 gifts that would lower the check let through](docs/img/7-results.png) | ![14 of 14 federal court cases reach SSA's and the court's outcome, and the meals rule the cases added](docs/img/9-field-cases.png) |

## How it works

1. **A page of needs.** A family member lists what the person needs and who sells it, or makes the page from a fundraiser link. The sample is Maya's page at `/g/maya`.
2. **Any amount, routed by the rules.** A donor types one number. The rules engine splits it across the needs and the ABLE account so that none of it counts as income, and shows the check before and after. Claude reads bills and fundraiser pages; code decides every dollar.
3. **One PayPal checkout, many payees.** One Orders v2 order with a purchase unit and payee for each recipient. The donor approves once, with a PayPal login or as a guest by card, PayPal captures each payment separately, and Giftwise never holds the money.
4. **A public receipt and the month's report.** Every payee with its PayPal capture ID, the rules that applied, a live "Check with PayPal now" button, a hash-chained ledger anyone can verify, and the report to Social Security, in full and in Easy Read.

## More

- [docs/results.md](docs/results.md): the referee and its 59 bills, the two error rates, SSA's examples, the court cases, 100,000 random gifts, the Federal Register watch, and the nightly checks on Render Workflows.
- [docs/real-world.md](docs/real-world.md): real money (shops onboarded through PayPal, `PAYPAL_ENV=live`, ABLE gift pages, fees, timing), why one shared page beats paying yourself, who it reaches, running it for real, and a first pilot.
- [docs/inside.md](docs/inside.md): what the AI never decides, how each page is designed, and every feature with the PayPal API or sponsor tool behind it.
- [docs/tests.md](docs/tests.md): every suite with its command and count.

## Run it yourself

```bash
npm install
docker compose up -d          # Postgres 17
cp .env.example .env.local    # add your PayPal sandbox and Anthropic keys
npm run db:push
npm run dev -- -p 3100        # http://localhost:3100
```

[TESTING.md](TESTING.md) explains every variable, the sandbox accounts and the test suites. `npm run checks:local` runs the same 25 outside checks as the nightly Render Workflow against your local copy.

To host your own copy, [`render.yaml`](render.yaml) creates the web service, its database, the `giftwise-checks` Render Workflow and the nightly cron job on Render. Give the web service and the cron job a Render API key (`RENDER_API_KEY`) so they can start the workflow:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/usv240/giftwise)

## Sources and credits

Every rule cites the regulation or SSA's operating manual (POMS). Photographs and video come from open collections and are credited in [`public/images/credits.json`](public/images/credits.json) and [`public/media/credits.json`](public/media/credits.json). Maya, her family and the shops are fictional.

## License

[MIT](LICENSE)
