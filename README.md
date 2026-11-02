# Giftwise

Benefit-safe giving for people on SSI. Family and friends give through PayPal, and Giftwise pays the shop, the clinic or her ABLE account directly, so her monthly check stays whole.

- **Live demo:** HOSTED_URL (PayPal sandbox, no Giftwise login needed)
- **For judges:** start at [`/judges`](HOSTED_URL/judges). The sandbox buyer login and step-by-step checks are in [TESTING.md](TESTING.md).

## The problem in one number

About 7.3 million people receive SSI (September 2026). SSI counts cash gifts as income. Give Maya $1,000 in cash and, two months later, her $994 check drops to $74. Pay the shop for something she needs and the same $1,000 leaves her check at $994. Giftwise does that routing for every gift, with the rule and its source shown each time ([20 CFR 416.1121](https://www.ecfr.gov/current/title-20/chapter-III/part-416/subpart-K/section-416.1121), [POMS SI 00830.520](https://secure.ssa.gov/poms.nsf/lnx/0500830520)).

## How it works

1. **A page of needs.** A family member lists what she needs and who sells it. The sample is Maya's page at `/g/maya`.
2. **Any amount, routed by the rules.** A donor types one number. A deterministic rules engine splits it across her needs and her ABLE account so that none of it counts as income, and shows her check before and after.
3. **One PayPal checkout, many payees.** Giftwise creates one Orders v2 order with a purchase unit and payee for each recipient. The donor approves once, PayPal captures each payment separately, and Giftwise never holds the money.
4. **A public receipt.** Every payee with its PayPal capture ID, the rules that applied, a live "Check with PayPal now" button, and a hash-chained ledger anyone can verify.

## What is inside

- **PayPal:** Orders v2 with several payees in one order, the JavaScript SDK v6 button, server-side capture with `PayPal-Request-Id` idempotency, live order lookups, and sandbox negative testing for declined cards.
- **Seven failure cases, run live** on `/judges`: declined card, double click, unapproved payment, a browser changing the amount or payee, a gift that would lower her check, an edited ledger entry, and refunds.
- **Claude (`claude-opus-5-5`):** reads bills, quotes and fundraiser pages into structured data. The rules engine, not the model, decides where the money goes.
- **Developer API:** free sandbox keys stored only as hashes, rate limits, OpenAPI 3.1 at `/openapi.json`, docs and a live playground at `/developers`.
- **Design:** light and dark themes, phone and desktop, an Info button on every element, and WCAG 2.2 AA checked with axe.

Built with Next.js 16, React 19, TypeScript, Postgres 17 and Drizzle, hosted on Render.

## Run it yourself

```bash
npm install
docker compose up -d          # Postgres 17
cp .env.example .env.local    # add your PayPal sandbox and Anthropic keys
npm run db:push
npm run dev -- -p 3100        # http://localhost:3100
```

[TESTING.md](TESTING.md) explains every variable, the sandbox accounts and the test suites. To host your own copy, [`render.yaml`](render.yaml) creates the web service and its database on Render:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/usv240/giftwise)

## Tests

| Suite | Command | Result |
|---|---|---|
| Rules engine and routing | `npm test` | 26 of 26 |
| API end to end | `npm run e2e:api` | 50 of 50 |
| Browser end to end | `npm run e2e:ui` | 46 of 46 |
| Accessibility, 12 pages in light and dark, phone and desktop | `npm run e2e:a11y` | 48 of 48 page views |
| Real PayPal checkout as the sandbox buyer | `npm run e2e:paypal` | 14 of 14 |
| Failure cases against the PayPal sandbox | `/judges` | 7 of 7 |

Set `BASE_URL` to run the end-to-end suites against a deployed copy.

## Sources and credits

Every rule cites the regulation or SSA's operating manual (POMS). Photographs and video come from open collections and are credited in [`public/images/credits.json`](public/images/credits.json) and [`public/media/credits.json`](public/media/credits.json). Maya, her family and the shops are fictional.

## License

[MIT](LICENSE)
