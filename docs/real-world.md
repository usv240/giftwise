# How this works for real

The demo runs in PayPal's sandbox. Here is what changes when real money moves, who it reaches, and who runs it first. The same answers, with their sources, are on every gift page, at [`/about#real`](https://giftwise-405i.onrender.com/about#real) and on [`/evidence/impact`](https://giftwise-405i.onrender.com/evidence/impact). Back to the [README](../README.md).

## Real money

- **What moves where, on the sample year.** Of Maya's $6,328 in 43 gifts, $3,519 (28 gifts) is paid to shops and clinics through PayPal and $2,724 (14 gifts) goes through her ABLE plan's own gift page; the other $85 is a jacket given as itself. `sampleYearSplit()` in [`src/lib/impact.ts`](../src/lib/impact.ts) computes the split by running every gift through the rules engine.
- **Why the ABLE part goes through the plan's own gift page.** Each plan takes gifts its own way. ABLEnow and IAble use [Ugift codes](https://www.iable.gov/resources/give-a-gift), paid by bank transfer or check. [STABLE](https://stableaccount.com/benefits/gifting), [CalABLE](https://calable.ca.gov/how-it-works/gifting) and [ABLE United](https://www.ableunited.com/usage/gifting) give each account its own gift link. In the demo the ABLE account is a sandbox PayPal account; for real, Giftwise works out the ABLE amount the same way and sends the giver to the plan's page for that part, and the gift page and every receipt with an ABLE line say so: with a Ugift plan the giver types the account's six-character code (shown like 1A2-B3C) at UgiftABLE.com, which opens the owner's gifting page ([IAble](https://www.iable.gov/resources/give-a-gift)); ABLE United asks for the owner's own gifting link ([ABLE United](https://www.ableunited.com/usage/gifting)). PayPal carries everything paid to a shop or a clinic.
- **Every shop needs a PayPal business account**, because PayPal pays the shop directly. Giftwise would onboard each shop with PayPal's [Partner Referrals API](https://developer.paypal.com/docs/multiparty/seller-onboarding/before-payment/): the shop signs up or links its account in PayPal's own flow, PayPal returns its `merchantIdInPayPal`, and each order sets `payee.merchant_id` in place of the sandbox email ([pay another account](https://developer.paypal.com/docs/checkout/standard/customize/pay-another-account/)). In the sandbox, this app's create call returns 403 `NOT_AUTHORIZED` (November 8, 2026, [`scripts/partner-referrals-probe.ts`](../scripts/partner-referrals-probe.ts)): PayPal opens the API to a platform it has approved as a partner, so the demo pays each shop by `payee.email_address`.
- **What going live changes, file by file.** (1) `PAYPAL_ENV=live` moves the REST API, the JavaScript SDK and PayPal's MCP server together ([`src/lib/paypal/env.ts`](../src/lib/paypal/env.ts), with a test that no other file names a PayPal host). (2) The live app's `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID` and `PAYPAL_WEBHOOK_ID` ([`render.yaml`](../render.yaml) lists each). (3) For each shop, once PayPal approves the partner account: one Partner Referrals call, the merchant ID stored as the need's payee account (`payeeEmail()` in [`src/lib/households.ts`](../src/lib/households.ts) reads it), and `payee: { merchantId }` in place of `payee: { emailAddress }` in `createPayeeOrder` and `createRoutedOrder` ([`src/lib/paypal/orders.ts`](../src/lib/paypal/orders.ts)). (4) The ABLE share goes to the plan's own gift page instead of a PayPal payee, as below.
- **A shop without PayPal** can still be paid in a way that keeps the check whole. Gifts can go to the person's ABLE account for any [qualified disability expense](https://www.irs.gov/newsroom/able-accounts-can-help-people-with-disabilities-pay-for-disability-related-expenses) (housing, education, transportation, health, assistive technology and more). Organizations can also pay with Payouts, which emails the shop a claim link. An unclaimed payout [returns to the sender after 30 days](https://developer.paypal.com/docs/payouts/standard/reference/payment-processing/), never to the person.
- **Timing matters for rent help.** STABLE and CalABLE hold gifts made through a gift page for 10 business days before they can be withdrawn. Housing money taken out of an ABLE account should be spent that month ([POMS SI 01130.740](https://secure.ssa.gov/poms.nsf/lnx/0501130740)), so rent help through ABLE works best about two weeks before the bill is due.
- **Fees:** US buyers pay [no PayPal fee](https://www.paypal.com/us/digital-wallet/paypal-consumer-fees) when no currency conversion is involved, and the shop pays PayPal's usual [merchant fee](https://www.paypal.com/us/business/paypal-business-fees). The demo adds nothing on top. On PayPal's partner program, a platform fee can be set per order (`payment_instruction.platform_fees`, shown to the shop as partner commissions), so Giftwise could cover its costs without charging the giver or the person on SSI ([multiparty](https://developer.paypal.com/docs/multiparty/)).

## Why not pay the shop yourself?

For one repair from one giver, paying the shop works, and it is what Giftwise does. A year of help from many people is where one shared page adds the rest. Measured on Maya's sample year, each gift priced by the rules engine both ways (`payItYourself()` in `src/lib/impact.ts`):

- **Housing help.** 11 of the 43 gifts ($2,124) were rent or a utility bill. Paid straight to the landlord or the utility, help with housing still lowers her check; Giftwise sends it through her ABLE account instead.
- **Gifts with no shop.** 3 gifts ($600) were savings with no shop behind them; given on their own, they arrive as cash.
- **Her check.** Each giver paying on their own, the engine lowers 10 of her monthly checks, $1,747.33 in all. With one shared page, every check stays whole.
- **The report.** 10 months with income or housing help to tell Social Security about, against 0 with Giftwise, which writes the report either way.
- **ABLE's yearly limit** is $20,000 from every giver together; Giftwise adds the page's ABLE gifts so far this year to the total before it routes the next one (`withAbleSoFar()` in `src/lib/households.ts`).
- **One checkout** pays up to 10 recipients in one PayPal order, and on a shared page no need is paid past what it still needs (a promise held on 100,000 random gifts).

## Who it reaches

- **Paid at a shop:** everyone on SSI, all 7.4 million people receiving it in January 2025 ([CRS IF10482](https://www.congress.gov/crs-product/IF10482), from SSA's Monthly Statistical Snapshot).
- **Through ABLE:** anyone whose blindness or disability began before age 46, the rule since January 1, 2026 ([POMS SI 01130.740](https://secure.ssa.gov/poms.nsf/lnx/0501130740)). That covers all 1.0 million children on SSI. The 3.9 million adults aged 18 to 64 are all on SSI for blindness or disability, and those whose condition began before 46 qualify, as do people 65 or older whose blindness or disability began then; SSA counts recipients by age rather than by when a disability began, so the adult share is a range, not one number. About 14 million people can open an ABLE account, an estimated 6 million of them since January 1, 2026, and more than 246,000 accounts are open ([ABLE National Resource Center](https://www.ablenrc.org/achievable-newsletter-june-2026-issue/)).
- **Help from others changes the check for many people:** in January 2022 SSA lowered the payment of 793,000 people on SSI for food or housing someone else provided ([88 FR 9779](https://www.govinfo.gov/content/pkg/FR-2023-02-15/html/2023-02731.htm)).

## Running it for real

The hosted demo is sized for a sandbox and says so on [`/evidence/operations#real`](https://giftwise-405i.onrender.com/evidence/operations#real). Each limit is an operating range with a known next step:

| The demo runs on | A real deployment changes it to |
|---|---|
| One Render Starter web instance (0.5 CPU, 512 MB), always on | Several instances behind Render's load balancer with autoscaling; the rate limits and request log already live in Postgres, so nothing is per-instance |
| One 256 MB Postgres with a 1 GB disk, no pooler | A larger Postgres with a connection pooler (PgBouncer or Render's), point-in-time recovery, and a restore tested on a schedule |
| Share images rendered on request; no uploads kept | Object storage with signed URLs for anything a family uploads (bills, photos), never the database |
| About $2 of Claude a day, capped and shown on `/ops` | A budget per organization, with the same per-call accounting |
| No login: the organizer's page is a private link shown once and stored as a hash; the organizations page is a sample fund | Login and roles for organizations (who can send a batch, who can only view), with the manage link kept for families |
| One PayPal sandbox app and one webhook, `PAYPAL_ENV=sandbox` | `PAYPAL_ENV=live` with the live app, and a registered webhook per environment, each with its own `PAYPAL_WEBHOOK_ID` |
| Nightly outside checks on Render Workflows | The same checks on every deploy, plus Sentry (`SENTRY_DSN`) wired for server, edge and browser with personal data masked |

What stays the same: structured JSON logs with a request id on every line, limits and logs in Postgres, the audit ledger, the public `/ops` page, and the Render Workflows fan-out for anything that runs in the background (the nightly checks, `monthlyRun` on the 1st, `rulebookIndex` weekly): one task per unit of work, in parallel, with retries, started by cron or the Render SDK.

**Under load.** `npm run test:load` measures the two free paths every visitor uses, on the deployed site (gently: 10 visitors at once, stopping at the first error) and on a laptop (100 at once); both are on [`/evidence/operations#load`](https://giftwise-405i.onrender.com/evidence/operations#load), labeled by where each ran.

## Who runs it first

Three groups already help people on SSI with money every month, and each can run Giftwise as it is today. How it compares with prepaid cards, special needs and pooled trusts, benefits calculators, benefits counselors, fundraising sites, PayPal.me, ABLE gift pages and paying the shop yourself, each from its own pages, is on [`/evidence/impact#compare`](https://giftwise-405i.onrender.com/evidence/impact#compare).

- **Benefits counselors.** Social Security funds free benefits counseling nationwide through its Work Incentives Planning and Assistance projects; its current round planned 75 projects and $20 million ([WIPA-WIP-21-001](https://www.highergov.com/grant-opportunity/ssa-work-incentives-planning-and-assistance-program-wipa-331605/)). A counselor makes the gift page with the family, and each month the family has the report to file by the 10th.
- **State ABLE programs.** 46 states and DC run one, and 31 plans accept people from any state ([ABLE National Resource Center](https://www.ablenrc.org/choose-plan/)). The ABLE share of each gift goes to the plan's own gift link; needs better paid to a shop are paid there through PayPal.
- **Payee organizations.** About 1 in 10 of the 7.7 million people with a representative payee are served by an organization ([CRS IF13018](https://www.congress.gov/crs_external_products/IF/PDF/IF13018/IF13018.2.pdf), FY2024). One PayPal Payouts batch pays shops and ABLE accounts for many people, with each person's ledger and report.

**A first pilot.** One benefits counseling project offers Giftwise to 25 families it already counsels, for 120 days: two months of gifts, and the checks SSA pays for those months two months later. It measures two outcomes, both from records Giftwise already keeps:

1. **SSI dollars kept.** The check each gift leaves with Giftwise, compared with the same gift as cash, priced by the same rules when it is made. Recorded in the audit ledger: each `paypal.routed_order.created` entry holds `checkWithRouting` and `checkIfCash`, hash-chained (`npm run verify-ledger`).
2. **Checks that match the report.** The check SSA pays each month, compared with the one the family's monthly report said to expect, against the measured rate of 0 of 55 gifts let through that the rule counts. The report is rebuilt from the payments table (`buildReport()`, `totals.check`) and checkable by its QR code; SSA's amount is on the family's notice.

**Why it holds up if a larger tool adds the same AI.** The model call is the easy part to copy; what decides here is the rules in code, a ledger and reports anyone can check, and error rates measured on Social Security's own examples and federal court cases.
