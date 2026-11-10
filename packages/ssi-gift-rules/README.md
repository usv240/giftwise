# ssi-gift-rules

How the US Supplemental Security Income (SSI) program counts a gift, as code. Give it a gift (cash, a bill paid straight to a shop, an item, or a deposit to an ABLE account) and it returns what counts as income, the check that month decides, the best way to give the same amount, and the rule and source behind every step.

It is the rules engine inside [Giftwise](https://github.com/usv240/giftwise), built from the same source files, with no dependencies.

## Install

```bash
npm install ssi-gift-rules
```

No dependencies. Node 18 or later, ES modules or CommonJS, with types. To build it from this repo instead: `cd packages/ssi-gift-rules && npm run build`, and `npm test` checks the build against SSA's worked examples.

## Use it

```js
import { evaluateGift, planMonths, DEFAULT_PROFILE } from "ssi-gift-rules";

const cash = evaluateGift({ amount: 1000, delivery: "cash", date: "2026-04-10" });
cash.checkAfter;          // 74      (the June check, two months after April)
cash.bestRoute;           // "vendor"
cash.checkWithBestRoute;  // 994
cash.ruleIds;             // ["R-CASH-01", "R-INFREQ-01", "R-GIE-01", "R-RMA-01", "R-RES-01"]
cash.explanation.plain;   // "Cash counts as income. $1,000 minus $80 in exclusions leaves $920 counted in April, ..."

const shop = evaluateGift({ amount: 420, delivery: "vendor", category: "equipment", date: "2026-04-10" });
shop.checkAfter;          // 994

// Several gifts across months: the $60 quarterly exclusion and savings carry over the way SSA counts them.
const year = planMonths(gifts, { ...DEFAULT_PROFILE, savings: 800 });
```

`delivery` is `"cash"`, `"vendor"` (paid straight to the business), `"item"` or `"able"`. `category` says what the money is for; rent, mortgage, property tax and utilities are shelter costs, which SSA counts as in-kind support even when paid to the landlord.

## What it covers

Each rule has an id, a plain sentence and its sources in `RULES`:

| Rule | What it says | Source |
|---|---|---|
| R-CASH-01 | Cash given to the person counts as income in the month it arrives | 20 CFR 416.1121, POMS SI 00830.520 |
| R-INFREQ-01 | The first $60 a quarter of one-off unearned income is not counted, in the order it arrives | POMS SI 00810.410 |
| R-GIE-01 | The first $20 of income each month is not counted | POMS SI 00810.420 |
| R-VEND-01 | Paying a business directly for something other than shelter is not income | 20 CFR 416.1103(g), POMS SI 00815.400 |
| R-SHEL-01, R-SHEL-VTR | Shelter paid by someone else is in-kind support, up to the monthly cap, or the one-third reduction when the person lives in another's household that also provides all meals | 20 CFR 416.1130, 416.1131, POMS SI 00835.020 to .901 |
| R-SHEL-02 | A prepaid housing bill counts in the months it covers (set `covers` on the gift) | POMS SI 00835.360 |
| R-SHEL-03 | A home or other shelter given as itself (`delivery: "item"`; a home is category `mortgage`) counts in the month received, up to the monthly cap | POMS SI 00835.400, SI 00835.310, SI 00815.550 |
| R-SHEL-04 | A co-owner's payment is not a gift: each month it covers counts in that month, past months included (set `payerCoOwns` with `covers`) | POMS SI 00835.360 D.3 |
| R-SHEL-05 | Rent below market from a parent or child: the lesser of market rent and the cap, less the rent paid (set `rentPaid`; `amount` is market rent less that rent) | POMS SI 00835.380, 89 FR 25507 |
| R-SHEL-06 | Rent or another housing bill paid weekly counts as the weekly amount times 13, divided by 3, a two-week amount halved first (set `every: "week"` or `"two_weeks"`) | POMS SI 00835.474 B.3 |
| R-SHEL-07 | Housing paid from outside for the whole household is divided among the people who live there (set `householdSize` on the profile) | POMS SI 00835.350 B.4 and C, SI 00835.380 D.1.d |
| R-SHEL-08 | Living in another person's household and paying less than a pro rata share of its housing costs (within $20 counts as paid), its shelter lowers the check every month, gift or not: the one-third reduction when it provides all meals, otherwise the share less what is paid, up to the cap (set `householdCosts` with `householdSize`, or `proRataShare`, and `householdPays`) | 20 CFR 416.1133, 416.1131, POMS SI 00835.160, SI 00835.340 |
| R-LOAN-01, R-LOAN-02 | A bona fide loan (must be repaid unconditionally, agreed when given, with a feasible plan) is not income; housing lent from outside counts only for what need not be repaid, and the household's own shelter lent counts as what the person pays (set `loan` on the gift) | 20 CFR 416.1103(f), POMS SI 00835.482, SI 01120.220 |
| R-FOOD-01 | Food stopped counting on September 30, 2024 | 89 FR 21199 |
| R-ITEM-01, R-ITEM-02 | A gifted item for personal or household use is not income; event tickets are | 20 CFR 416.1103(g), POMS SI 01130.430, SI 00830.520 |
| R-EDU-01 | Gifts used for tuition, books and school costs are not income | POMS SI 00830.455 |
| R-ABLE-01, R-ABLE-02 | Deposits to an ABLE account are not income; housing withdrawals must be spent that month | POMS SI 01130.740 |
| R-ABLE-03 | The part of an ABLE balance over $100,000 counts toward savings (set `ableBalance` on the profile); over the limit because of it, SSI cash stops and Medicaid continues | POMS SI 01130.740 D.1 |
| R-RES-01 | Countable savings must be $2,000 or less on the 1st ($3,000 for a couple); over it, the month's check is $0 | POMS SI 01110.003, SI 01110.600 |
| R-RMA-01 | Income in one month sets the check two months later | POMS SI 02005.001 |

Set `householdProvidesAllMeals: false` on the profile when the person lives in another's household but buys their own food. Amounts follow the check's year: $994 a month for an individual in 2026 and $1,029 from January 2027 (91 FR 67380), so November and December income set the January and February checks at the new rate, as SSA does (POMS SI 02005.001 E.4.c). State supplements, deeming from a spouse or parent, earned income beyond the standard exclusions and trusts are not modeled.

## Checked against Social Security's own answers

`examples/ssa-examples.json` holds worked examples from SSA's operating manual, each with SSA's answer quoted word for word, and `examples/ssa-examples-results.json` holds how the engine scored on them. `npm test` checks that this build gives the same answer on every example as the published results.

## Not legal advice

Guidance based on published Social Security rules, with a source for every answer. For couples, state supplements or Medicaid rules that differ by state, a benefits counselor can help.

MIT licence.
