# Testing Giftwise

Giftwise runs on PayPal's sandbox, a practice version of PayPal where no real money moves. You do not need a Giftwise account.

- **Hosted demo:** [giftwise-405i.onrender.com](https://giftwise-405i.onrender.com), hosted on Render.
- **Start here:** [`/judges`](https://giftwise-405i.onrender.com/judges) has the five-minute path, the failure cases you can run live, and the latest test results.

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

1. Open `/g/maya`. If any need already shows as paid, press **Reset the sample page** at the bottom of the right column.
2. In **Give any amount**, type `1500`. The preview shows where each dollar will go:

   | Paid to | For | Amount |
   |---|---|---|
   | Riverside Mobility Repair | Wheelchair repair | $420 |
   | Eastgate College Bookstore | Laptop for college | $649 |
   | Maya's ABLE account | Electric bill, November | $138 |
   | Northside Physical Therapy | Therapy co-pay | $90 |
   | Maya's ABLE account | Savings for later | $203 |

   Her SSI check stays $994 this way. The same $1,500 given as cash would bring it to $0.
3. Press the PayPal button under the preview. In the PayPal window, log in with the sandbox login above and press **Complete Purchase**. PayPal asks for no shipping address, because nothing is shipped to you.
4. The box thanks you and lists all five payments. The need cards update to **Paid by John**, and **Still needed** drops to $0.
5. Press **See the receipt**. It lists every payee with its PayPal capture ID, the rules that applied, and their sources.
6. On the receipt, press **Check with PayPal now** to ask PayPal for the order live, then **Verify the ledger** to recompute the audit trail's hash chain.

To pay for a single need instead, press **Pay with PayPal** on its card. You can reset the sample page at any time; PayPal keeps its own sandbox records.

### Who receives the money

Each payment in the order names its own payee, and PayPal captures each one separately. Giftwise is never a payee: nothing goes to Giftwise or to Maya's bank account. In the sandbox, the three sample shops share one business account and her ABLE account is a second one:

| Recipient | Sandbox business account |
|---|---|
| Riverside Mobility Repair, Eastgate College Bookstore, Northside Physical Therapy | `sb-viaij53657116@business.example.com` |
| Maya's ABLE account | `sb-ros8g53657188@business.example.com` |

## Failure cases, live

On `/judges`, under **Failure cases**, press **Run all eight checks**. Seven create real sandbox orders and show what PayPal answered; one shows the referee catching a wrong AI answer.

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

## Maya's year, in AG Studio

1. Open `/dashboard`. It shows a fictional sample year of gifts to Maya, plus every gift paid on this site, and her check each month with Giftwise and as cash.
2. The **Giftwise check** widget runs the rules engine in your browser. Press a giver, for example **Dan**, and it recomputes for just that giver's gifts: the months in view, the lowest check cash would have left, and how much Giftwise kept.
3. Press **Edit the dashboard** to move widgets, change fields, or add another Giftwise check from the widget menu.
4. In edit mode, open **AI Assistant** and choose **What if it were cash?**. AG Studio's agents, running on Claude, call the Giftwise rules engine and answer with the check figure and the rules behind it. **Add a chart by giver** builds a new widget.

Without an AG Studio licence key the dashboard shows AG Studio's trial watermark; add `NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY` to remove it.

## For organizations: one payout batch

1. Open `/organizations`. The sample fund's balance comes live from PayPal's Balances API.
2. Enter a grant for Maya, for example `150`, and press **Show the routing**. Giftwise splits it across her open needs and her ABLE account, and shows her check with the grant and as cash.
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
| `PAYPAL_VENDOR_EMAIL`, `PAYPAL_ABLE_EMAIL` | Two sandbox business accounts that receive gifts: Testing Tools > Sandbox Accounts |
| `DATABASE_URL` | Already set for the Docker database |
| `ANTHROPIC_API_KEY` | Reads bills and fundraiser pages |
| `SANDBOX_BUYER_EMAIL`, `SANDBOX_BUYER_PASSWORD` | Only for `npm run e2e:paypal` |

The sponsor tools listed in `.env.example` are optional. `/status` shows whether each one is live or using its fallback. Maya's sample page is created the first time you open `/g/maya`.

## Run the tests

Start the app on port 3100 first. Run `npm run test:clean` and reset the sample page before the API and card-approved suites, because they expect her needs to be open and the daily limits for new keys and pages to be clear; the PayPal checkout suite resets it on its own. The browser suites drive Chrome; if Chrome is not at `C:/Program Files/Google/Chrome/Application/chrome.exe`, set `CHROME_PATH`.

| Suite | Command | Expected |
|---|---|---|
| Rules engine and routing | `npm test` | 45 passed |
| API end to end | `npm run e2e:api` | 70 passed |
| Browser end to end | `npm run e2e:ui` | 56 passed |
| Accessibility and layout | `npm run e2e:a11y` | All 68 page views pass |
| PayPal checkout as the sandbox buyer | `npm run e2e:paypal` | 14 passed |
| An agent starts a checkout over MCP, the buyer approves the link | `npm run e2e:agent` | 5 passed |
| Card-approved gift to five payees | `npm run e2e:routed` | Five captures, a repeat capture that changes nothing, and COMPLETED at PayPal |
| Audit ledger | `npm run verify-ledger` | "Ledger verified" |
| Types and lint | `npm run typecheck`, `npm run lint` | No errors |

- The API and browser suites read a sample bill with Claude, so they need `ANTHROPIC_API_KEY`.
- The API and browser suites each create a developer key. With five new keys a day per address, a third full run on the same day reports that limit in the key checks; they pass again the next day.

## If something looks off

- **The PayPal window does not appear:** allow pop-ups for the site, then press the button again.
- **"This need is already paid. Thank you!":** press **Reset the sample page**.
- **Completing a payment takes a few seconds:** PayPal captures each payee in turn.
- **The failure-case runner asks you to wait:** runs are 20 seconds apart.
