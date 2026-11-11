<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Giftwise, for an agent reading this repository

- What it is: benefit-safe giving for people on SSI. A deterministic rules engine (`src/lib/rules/engine.ts`) picks every payee and amount before money moves; one PayPal Orders v2 order pays those payees (`src/lib/paypal/gift-order.ts`), captured once (`src/lib/paypal/capture.ts`). Claude reads documents and acts as two reviewers (`src/lib/review/referee.ts`); it never decides money.
- Where the evidence is: `docs/evidence-index.md` maps ten claims to the live page, the file and line, and the test. Every figure in `README.md`, `TESTING.md` and `docs/*.md` is computed by code (`src/lib/impact.ts`, `src/lib/research.ts`) or recorded in `content/eval/` and `content/test-results.json`, and `tests/docs-numbers.test.ts` and `tests/research.test.ts` fail when a document disagrees. The README stays under 2,000 words; depth goes in `docs/`.
- How to run the tests: `npm test` needs no keys and no database (tests that need Postgres skip with the reason in their names); `npm run typecheck` and `npm run lint` must be clean. With a server on port 3100, `npm run e2e:smoke` and `npm run e2e:a11y` need no keys; the API, browser, PayPal and agent suites need `.env.local` (see `TESTING.md`). `npm run test:results <suite>` records counts.
- Rules for changes: no em dashes, no emojis, plain US spelling, neutral to positive copy, light theme by default; never print a secret; schema changes are reviewed SQL plus `src/lib/db/schema.ts`.
