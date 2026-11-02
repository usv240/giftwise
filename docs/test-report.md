# Giftwise test report

Run on 2026-11-02 against the local build with PayPal sandbox and Claude Opus 5.5 connected.

## How to run

```
docker compose up -d          # Postgres
npm run dev                   # app on http://localhost:3000 (PORT to change)
npm test                      # rules engine unit tests
npm run e2e:api               # API end-to-end (needs the app running)
npm run e2e:ui                # browser end-to-end + accessibility (Chrome)
npm run e2e:paypal            # clicks the real PayPal button; full approval if SANDBOX_BUYER_EMAIL/PASSWORD are set
npx tsx --env-file=.env.local scripts/paypal-card-e2e.ts   # sandbox card payment straight to the shop
```

## Results

| Suite | Result | What it covers |
|---|---|---|
| Rules engine (Vitest) | 22 of 22 pass | Every rule row: cash gifts, the $60 and $20 exclusions, vendor payments, housing support, the one-third reduction, food (2024 rule), education, items, ABLE, savings limit, couples, earned income, the two-month delay, quarterly sharing |
| API end-to-end | 31 of 31 pass | check-gift numbers ($74, $994, $662.67), validation errors, plan-month, all 8 presets match their expected answers, downloads (JSON, CSV), live bill reading (Claude reads the sample electric bill as a $138 utility), live fundraiser reading (all 3 uses keep $994), PayPal order creation, refusal to capture before approval, bad ids |
| Browser end-to-end | 39 of 40 pass | Gift Checker, Info buttons (hover, pin, Escape), View menu persistence, Try tabs (describe, CSV, bill upload with live AI, readable results), preset pages and downloads, live PayPal buttons, skip link, accessibility scan with axe (WCAG 2.2 AA, light and dark, desktop and phone): no serious or critical issues |
| PayPal sandbox payment | Pass | A sandbox card payment of $420 captured with the shop as payee (Orders v2 "pay another account"); seller receivable breakdown returned; audit ledger hash chain intact |
| PayPal button | Pass to the login screen | Clicking the button creates the order through our server and opens PayPal sandbox checkout for that exact order. Buyer approval needs the sandbox buyer login |

## Known gaps (being built)

- Pages linked from the menu that are not built yet: Developers, For judges, How it is built (stack), Status, About.
- Full buyer approval in the automated test needs `SANDBOX_BUYER_EMAIL` and `SANDBOX_BUYER_PASSWORD` in `.env.local`.
- PayPal Transaction Search permission was enabled on the app and is waiting for PayPal to activate it.

## Bugs found and fixed during this run

| Bug | Fix |
|---|---|
| A corrupted image upload crashed bill reading with an empty error | Image processing now returns a friendly message (422) |
| Info buttons' spoken name did not match their visible label (WCAG 2.5.3) | Spoken name now starts with the visible word "info" |
| Content that fades in on scroll was invisible to scanners and some assistive tech until scrolled | Content is never hidden in CSS; the fade runs only as it enters the screen |
| Low contrast on the "Reset the sample page" link and on facts in the open board row | Contrast raised above 4.5:1 |
| Info buttons inside the Try tab list broke the tablist pattern | Tabs contain only tabs; one Info sits beside them |
| Bill and fundraiser results were shown as raw JSON | Readable cards: what Claude read, then the rules engine's answer |
| Sample documents and the sample fundraiser page were missing | Generated in `public/samples` (fictional, marked SAMPLE) |
