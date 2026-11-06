-- Production hardening, 2026-11-06: rate limits, the request log and AI usage in Postgres.
-- The source of truth is src/lib/db/schema.ts; Render's preDeployCommand (npx drizzle-kit push --force) creates these
-- tables from it before each release. This file is the same change as reviewed SQL, for a database where drizzle-kit
-- cannot run: docker exec -i giftwise-postgres-1 psql -U giftwise -d giftwise < drizzle/2026-11-06-hardening.sql

create table if not exists rate_limit (
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (bucket, window_start)
);

create table if not exists request_log (
  id serial primary key,
  request_id text not null,
  route text not null,
  method text not null default 'GET',
  status integer not null,
  ms integer not null,
  created_at timestamptz not null default now()
);
create index if not exists request_log_created_idx on request_log (created_at);
create index if not exists request_log_request_idx on request_log (request_id);

create table if not exists ai_usage (
  id serial primary key,
  request_id text,
  route text not null default '',
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  ms integer not null default 0,
  replayed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_created_idx on ai_usage (created_at);
