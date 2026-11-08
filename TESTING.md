# Testing Giftwise

Giftwise runs on PayPal's sandbox, a practice version of PayPal where no real money moves. You do not need a Giftwise account.

- **Hosted demo:** [giftwise-405i.onrender.com](https://giftwise-405i.onrender.com), hosted on Render.
- **Start here:** [`/evidence`](https://giftwise-405i.onrender.com/evidence) has three numbers and the five-minute path; [`/evidence/operations`](https://giftwise-405i.onrender.com/evidence/operations) has the failure cases you can run live and the latest test results.

## PayPal sandbox buyer login

Use this login in the PayPal window that opens when you press a PayPal button on Maya's page.

| | |
|---|---|
| Email | `sb-tvnmx53636325@personal.example.com` |
| Password | `D.}t1I^T` |

- It is a PayPal sandbox personal account. It works only in the sandbox checkout window, and its balance is practice money.
- PayPal names this buyer John Doe, so a paid need reads "Paid by John".
- Please keep the password as it is so the next person can use it too. The login stays active through the end of judging.

## Make a payment (about 3 minutes)

1. Open `/g/maya`. If any need already shows as paid, open **Testing in the sandbox** at the bottom of the right column and press **Reset the sample page**.
2. In **Give any amount**, type `1500`. The preview shows where each dollar will go:

   | Paid to | For | Amount |
   |---|---|---|
   | Riverside Mobility Repair | Wheelchair repair | $420 |
   | Eastgate College Bookstore | Laptop for college | $649 |
   | Maya's ABLE account | Electric bill, this month | $138 |
   | Northside Physical Therapy | Therapy co-pay | $90 |
   | Maya's ABLE account | Savings for later | $203 |

   Her January check (set by gifts in November) stays $1,029 this way, the 2027 amount. The same $1,500 given as cash would bring it to $0.
3. Press the PayPal button under the preview. In the PayPal window, log in with the sandbox login above and press **Complete Purchase**. PayPal asks for no shipping address, because nothing is shipped to you. No PayPal login needed: choose **Debit or Credit Card** instead and use PayPal's test card `4012 8888 8888 1881`, any future expiry and any CVV.
4. The box thanks you and lists all five payments. The need cards update to **Paid by John**, and **Still needed** drops to $0.
5. Press **See the receipt**. It lists every payee with its PayPal capture ID, the rules that applied, and their sources.
6. On the receipt, press **Check with PayPal now** to ask PayPal for the order live, then **Verify the ledger** to recompute the audit trail's hash chain.

To pay for a single need instead, press the PayPal button on its card. You can reset the sample page at any time: its needs reopen, and every earlier receipt still opens.

### Who receives the money

Each payment in the order names its own payee, and PayPal captures each one separately. Giftwise is never a payee: nothing goes to Giftwise or to Maya's bank account. In the sandbox, each of the three sample shops has its own business account and her ABLE account is a fourth, so PayPal's record of a $1,500 gift shows five payments to four accounts:

| Recipient | Sandbox business account |
|---|---|
| Riverside Mobility Repair | `sb-y1vss53656738@business.example.com` |
| Eastgate College Bookstore | `sb-yau9l53656728@business.example.com` |
| Northside Physical Therapy | `sb-a6t8853656735@business.example.com` |
| Maya's ABLE account | `sb-ros8g53657188@business.example.com` |
| Shops on a page made from a fundraiser, or added on the organizer's page | `sb-viaij53657116@business.example.com` |

The server picks the account from the need, never from the browser (`payeeEmail()` in `src/lib/households.ts`), and `/status` shows how many separate accounts the sample uses under **PayPal payees**.

## Checked every night, on Render Workflows

On `/evidence/operations`, **Checked every night, from outside** shows the latest run of the `giftwise-checks` Render Workflow: 25 checks, each its own task, run in parallel with retries. That covers the eight failure cases against the PayPal sandbox, every page on the five-minute path, and eight public API promises (status, the ledger, the SSA report, the MCP tools, the Federal Register watch, the OpenAPI address, PayPal's return link, and a gift paid with a sandbox test card across its payees with no PayPal login, each capture checked at PayPal).

1. Press **Run the checks now**. The page starts a task run on Render Workflows and names it.
2. In about a minute the run files its results and the panel refreshes with the time of the run and its count. Open **All 25 checks, with each result**, or set **Display** to Technical to see what each check found.
3. `/status` shows the same run under **Outside checks**.

A run can start every 10 minutes. The nightly run starts from a Render cron job at 09:00 UTC.

## Failure cases, live

On `/evidence/operations`, under **Failure cases**, press **Run all eight checks**. Seven create real sandbox orders and show what PayPal answered; one shows the referee catching a wrong AI answer.

| Case | What you should see |
|---|---|
| The donor's card is declined | Nothing is charged, nothing is marked paid, and the donor sees a plain next step. |
| The donor clicks Pay twice | PayPal charges once. Both clicks get the same capture. |
| A payment PayPal has not approved | PayPal refuses, nothing is charged, and the message is plain. |
| A browser changes the amount or the payee | The server ignores both. Amount and payee come only from the need record. |
| A gift would lower her check | The rules engine skips that route and sends the money a benefit-safe way. |
| An AI reviewer gets the rule wrong | Its quote is not in its rulebook, so the referee sets it aside and her check stays whole. |
| Someone edits a past ledger entry | Recomputing the chain finds the exact entry that changed. |
| Only the shop can send money back | Giftwise cannot pull money from a shop. PayPal allows the refund only from the account that received it. |

The runner can be started again 20 seconds after the last run.

## An AI agent asks first

1. Open `/agents`. The recorded conversation shows June asking her Claude assistant whether to send Maya $300 in cash. The assistant reads Maya's page, plans the gift and checks what cash would do, all through Giftwise's MCP tools. When June says yes, it starts a PayPal checkout and gives her the link.
2. Press **Run it live** to run the same conversation now, about 30 seconds. It can run once a minute.
3. Open the PayPal link from the live run and approve it with the sandbox buyer login above. PayPal sends you back to Giftwise, which captures the payment and opens the receipt.
4. To connect your own agent, use the command on the page: `claude mcp add --transport http giftwise <hosted URL>/api/mcp`.

## Claude reads a bill, live

1. Open `/try/presets/electric-bill` and press **Read this bill live**. Claude reads the sample electric bill now (one call, about 5 seconds, counted against the site's daily AI budget, `AI_DAILY_CAP_USD`), and the rules engine prices what it read: her June 2026 check paid to the company, and through her ABLE account.
2. The line above the result says whether it was live. With no `ANTHROPIC_API_KEY`, or once the day's AI spend reaches the budget, the recorded run from `content/reviews/electric-bill-read.json` is shown with its date and the reason. `npx tsx --env-file=.env.local scripts/record-bill-read.ts` records a new one.

## Maya's benefit calendar, in Bryntum

Open `/g/maya/calendar`. Gifts are green when they do not count and orange when they do; Social Security's dates are blue (the check on the 1st, the report due on the 10th). Press **As cash**, then drag Aunt June's $150 on October 28 to November 2, or use **Move a gift** below the calendar. **What moving it did** lists each check that changed: December rises from $456 to $606 and January drops from $1,029 to $899, because the gift moved to a later income month (January is paid at the 2027 rate). The calendar is Bryntum Calendar 7.3.7 (the free trial, so it shows a trial watermark), and its theme follows the site's light and dark mode.

## Maya's year, in AG Studio

1. Open `/dashboard`. It shows a fictional sample year of gifts to Maya, plus every gift paid on this site, and her check each month with Giftwise and as cash.
2. The **Giftwise check** widget runs the rules engine in your browser. Press a giver, for example **Dan**, and it recomputes for just that giver's gifts: the months in view, the lowest check cash would have left, and how much Giftwise kept.
3. Press **Edit the dashboard** to move widgets, change fields, or add another Giftwise check from the widget menu.
4. In edit mode, open **AI Assistant** and choose **What if it were cash?**. AG Studio's agents, running on Claude, call the Giftwise rules engine and answer with the check figure and the rules behind it. **Add a chart by giver** builds a new widget.

Without an AG Studio license key the dashboard shows AG Studio's trial watermark; add `NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY` to remove it.

## Maya's report to Social Security

1. Open `/g/maya/report`. It opens on the month whose report is due next, with the deadline (10 days after the month ends).
2. The verdict for the gifts as given: nothing counts as income. Each gift is listed with the rule that says why, a link to the regulation or SSA manual section, and its PayPal capture or payout as proof. Gifts from the fictional sample year say they have no PayPal record; gifts you pay on Maya's page appear with their PayPal capture id and a link to the receipt.
3. Press **As cash**. The same month becomes the report Maya would have had to file: every gift to tell SSA about, what counts, her lower check two months later, and a call script.
4. **Print or save as PDF** keeps just the report; **Download CSV** gives the same lines as a spreadsheet. Set **Display** to Technical to see the rule ids.

The same report is at `GET /api/v1/ssa-report?page=maya&month=2026-10` and as the MCP tool `get_ssa_report`.

## For organizations: one payout batch

1. Open `/organizations`. The sample fund's balance comes live from PayPal's Balances API.
2. Enter a grant for Maya, for example `150`, and press **Preview where each dollar goes**. Giftwise splits it across her open needs and her ABLE account, and shows her check with the grant and as cash. **Send** stays off until the preview matches the grants.
3. Press **Send**. One PayPal Payouts batch pays each shop and her ABLE account directly. The page follows the batch until PayPal reports every item paid, with its PayPal transaction id.
4. Each paid item is then looked up in PayPal's Transaction Search report. In the sandbox a new transaction can take up to three hours to appear there, so it reads "Waiting for PayPal's report" until then.

Payouts spend the app's sandbox balance, so a batch is capped at $500, each household at $250, and each visitor at three batches a day. The grants also appear on `/dashboard`; **Reset the sample page** clears them from Maya's page.

## Developer API

- `/developers`: get a free sandbox key. It is shown once; Giftwise stores only its hash. Rotate or revoke it on `/developers/keys`.
- `/developers/docs`: every endpoint, field and error. `/openapi.json` has the same description for Postman and code generators.
- A key is optional. With one: 60 requests a minute and 1,000 a day. Without one: 20 a minute. Each address can create five new keys a day.

Try one call (use the hosted URL in place of `localhost:3100` if you prefer):

```bash
curl -X POST http://localhost:3100/api/v1/check-gift \
  -H "content-type: application/json" \
  -d '{"gift":{"amount":1000,"delivery":"cash","category":"other","date":"2026-04-10"},"profile":{"savings":1240}}'
```

The answer includes `"check_after": 74`, because $1,000 in cash counts as income, and `"best_route": "item"` with `"check_with_best_route": 994`: giving what she needs instead keeps her full check.

## Run it locally

You need Node.js 22 or newer (tested on 24), Docker, a PayPal developer account with a sandbox app, and an Anthropic API key for reading bills and fundraiser pages.

```bash
npm install
docker compose up -d          # Postgres 17 on port 5432
cp .env.example .env.local    # then fill in the values below
npm run db:push               # create the tables
npm run dev -- -p 3100        # open http://localhost:3100
```

| Variable | What it is |
|---|---|
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | Your sandbox app: developer.paypal.com > Apps & Credentials > Sandbox |
| `PAYPAL_VENDOR_EMAIL`, `PAYPAL_ABLE_EMAIL` | Sandbox business accounts that receive gifts (Testing Tools > Sandbox Accounts): one for shops on new pages, one for the ABLE account |
| `PAYPAL_VENDOR_EMAIL_RIVERSIDE`, `PAYPAL_VENDOR_EMAIL_EASTGATE`, `PAYPAL_VENDOR_EMAIL_NORTHSIDE` | Optional: one sandbox business account for each sample shop. A shop left unset is paid to `PAYPAL_VENDOR_EMAIL` |
| `DATABASE_URL` | Already set for the Docker database |
| `ANTHROPIC_API_KEY` | Reads bills and fundraiser pages |
| `SANDBOX_BUYER_EMAIL`, `SANDBOX_BUYER_PASSWORD` | Only for `npm run e2e:paypal` |

The sponsor tools listed in `.env.example` are optional. `/status` shows whether each one is live or using its fallback. Maya's sample page is created the first time you open `/g/maya`.

## Run the tests

Every push to GitHub runs [CI](.github/workflows/ci.yml): the dependency audit, types, lint, the unit tests, 20,000 random gifts drawn fresh for each run, the `ssi-gift-rules` package, then a production build against an empty Postgres with no service keys, checked by the smoke and accessibility suites. The suites below that move sandbox money need keys, so they run from a machine that has them.

Start the app on port 3100 first. Run `npm run test:clean` and reset the sample page before the API and card-approved suites, because they expect her needs to be open and the daily limits for new keys and pages to be clear; the PayPal checkout suite resets it on its own. The browser suites drive Chrome; if Chrome is not at `C:/Program Files/Google/Chrome/Application/chrome.exe`, set `CHROME_PATH`.

| Suite | Command | Expected |
|---|---|---|
| Rules engine, routing, monthly gifts, the SSA report and its Easy Read version, the checks workflow, the cited answers, the report code, the Spanish rule sentences, manage links and signatures, the gift finder, the rulebook search, the calendar planner and 1,000 random gifts, and the AI fallbacks | `npm test` | 257 passed |
| Social Security's own worked examples | `npm run eval:ssa` | 40 of 40 match SSA (Claude alone 32 of 40) |
| Real SSI cases from federal courts | `npx tsx scripts/run-field-cases.ts` | 14 of 14 agree with SSA and the court |
| 100,000 random gifts, needs and people | `npx tsx scripts/run-invariants.ts` | All twelve promises kept by all 100,000 |
| The rules watch, asked live | `GET /api/rules-watch` | Every Federal Register document reviewed; 2026 and 2027 amounts in use |
| A monthly gift, two months, as the sandbox buyer | `npm run e2e:monthly` | 8 of 8 |
| API end to end | `npm run e2e:api` | 99 passed |
| The organizer's side, with a signed webhook from a real sandbox capture (start the server with `GIFTWISE_WEBHOOK_ALLOW_LOCAL=1`) | `npm run e2e:manage` | 21 passed |
| The Postman collection, with Newman | `npm run test:postman` | 20 requests, 20 assertions |
| Browser end to end (with no AI key, the three steps where Claude reads a document are skipped) | `npm run e2e:ui` | 61 passed |
| Accessibility and layout | `npm run e2e:a11y` | All 136 page views pass |
| Every page and public endpoint with no service keys, each integration on its fallback | `npm run e2e:smoke` | 68 passed |
| PayPal checkout as the sandbox buyer | `npm run e2e:paypal` | 14 passed |
| An agent starts a checkout over MCP, the buyer approves the link | `npm run e2e:agent` | 5 passed |
| Card-approved gift to five payees | `npm run e2e:routed` | Five captures, a repeat capture that changes nothing, and COMPLETED at PayPal |
| Audit ledger | `npm run verify-ledger` | "Ledger verified" |
| Under load, 100 visitors at once on the free paths (writes `content/public/load-test.json`) | `npm run test:load` | Error rate 0% on both paths |
| Types and lint | `npm run typecheck`, `npm run lint` | No errors |
| Dependency audit, every severity | `npm audit` | 0 vulnerabilities |

- The API and browser suites read a sample bill with Claude, so they need `ANTHROPIC_API_KEY`.
- The API and browser suites each create a developer key. With five new keys a day per address, a third full run on the same day reports that limit in the key checks; they pass again the next day.

## If something looks off

- **The PayPal window does not appear:** allow pop-ups for the site, then press the button again.
- **"This need is already paid. Thank you!":** open **Testing in the sandbox** on the gift page and press **Reset the sample page**.
- **Completing a payment takes a few seconds:** PayPal captures each payee in turn.
- **The failure-case runner asks you to wait:** runs are 20 seconds apart.
