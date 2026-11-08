-- The sample page's reset keeps every payment, 2026-11-07.
-- POST /api/demo/reset used to delete the sample page's payments, so an earlier receipt (/r/{orderId}) stopped opening
-- and a capture still in flight found no row. Now a reset marks the earlier round instead: archived_at on each payment
-- (and on an organizer's own need that received gifts), so the row and its receipt stay, and it no longer counts toward
-- the page's needs, report, dashboard or totals.
-- The source of truth is src/lib/db/schema.ts; Render's preDeployCommand (npx drizzle-kit push --force) adds these two
-- nullable columns from it before the release starts. This file is the same change as reviewed SQL:
--   docker exec -i giftwise-postgres-1 psql -U giftwise -d giftwise < drizzle/2026-11-07-earlier-rounds.sql
-- Both statements are additive and safe to run twice; existing rows keep archived_at null (the current round).

alter table payments add column if not exists archived_at timestamptz;
alter table needs add column if not exists archived_at timestamptz;
