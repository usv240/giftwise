import { boolean, integer, jsonb, numeric, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const households = pgTable(
  "households",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    note: text("note").notNull().default(""),
    caregiverName: text("caregiver_name").notNull().default(""),
    profile: jsonb("profile").notNull().default({}),
    isSample: boolean("is_sample").notNull().default(true),
    /** SHA-256 of the organizer's private manage link token; the token itself is shown once and never stored. */
    manageTokenHash: text("manage_token_hash"),
    /** open | closed. A closed page shows its needs and receipts but takes no new gifts. */
    status: text("status").notNull().default("open"),
    /** Where to POST gift events (a Zapier Catch Hook, Slack workflow, any HTTPS endpoint), and the key that signs them. */
    webhookUrl: text("webhook_url"),
    webhookSecret: text("webhook_secret"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("households_slug_idx").on(t.slug), uniqueIndex("households_manage_token_idx").on(t.manageTokenHash)],
);

export const needs = pgTable("needs", {
  id: serial("id").primaryKey(),
  householdId: integer("household_id")
    .notNull()
    .references(() => households.id),
  title: text("title").notNull(),
  detail: text("detail").notNull().default(""),
  category: text("category").notNull(),
  /** vendor | able | item */
  route: text("route").notNull(),
  payeeName: text("payee_name").notNull(),
  /** Which sandbox account receives the money: "vendor" or "able". Resolved to an email on the server. */
  payeeAccount: text("payee_account").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  recurring: boolean("recurring").notNull().default(false),
  /** Where givers can see the item, when the need came from a product search (Channel3). */
  link: text("link"),
  /** open | partial | paid */
  status: text("status").notNull().default("open"),
  funded: numeric("funded", { precision: 10, scale: 2 }).notNull().default("0"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    /** Null for the ABLE share of a routed gift that is not tied to a specific need. */
    needId: integer("need_id").references(() => needs.id),
    householdId: integer("household_id").references(() => households.id),
    orderId: text("order_id").notNull(),
    /** The purchase unit inside the PayPal order (one per payee). */
    referenceId: text("reference_id").notNull().default(""),
    payeeName: text("payee_name").notNull().default(""),
    route: text("route").notNull().default("vendor"),
    captureId: text("capture_id"),
    /** created | captured | failed */
    status: text("status").notNull().default("created"),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    payeeEmail: text("payee_email").notNull(),
    payerName: text("payer_name"),
    debugId: text("debug_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("payments_order_ref_idx").on(t.orderId, t.referenceId)],
);

/** One item of a PayPal Payouts batch: an organization's grant, routed by the rules engine to one payee. */
export const payouts = pgTable(
  "payouts",
  {
    id: serial("id").primaryKey(),
    batchId: text("batch_id").notNull(),
    /** sender_item_id sent to PayPal: household id and the routed line, so each item maps back to its need. */
    senderItemId: text("sender_item_id").notNull(),
    funder: text("funder").notNull(),
    householdId: integer("household_id").references(() => households.id),
    needId: integer("need_id").references(() => needs.id),
    title: text("title").notNull().default(""),
    payeeName: text("payee_name").notNull(),
    payeeEmail: text("payee_email").notNull(),
    route: text("route").notNull(),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    /** PayPal's item status: PENDING | SUCCESS | FAILED | UNCLAIMED | RETURNED | ONHOLD | BLOCKED | REFUNDED | REVERSED */
    status: text("status").notNull().default("PENDING"),
    itemId: text("item_id"),
    transactionId: text("transaction_id"),
    /** Set once the item has counted toward its need, so a resync never counts it twice. */
    countedAt: timestamp("counted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("payouts_batch_item_idx").on(t.batchId, t.senderItemId)],
);

export const auditEvents = pgTable("audit_events", {
  id: serial("id").primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  ref: text("ref").notNull(),
  detail: jsonb("detail").notNull().default({}),
  prevHash: text("prev_hash").notNull(),
  hash: text("hash").notNull(),
});

/** Developer API keys. Only the SHA-256 hash and a short display prefix are stored; the key is shown once. */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: serial("id").primaryKey(),
    prefix: text("prefix").notNull(),
    hash: text("hash").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    purpose: text("purpose").notNull().default(""),
    /** Random id in an httpOnly cookie: the browser that created the key can see its usage. No passwords. */
    ownerId: text("owner_id").notNull(),
    createdIp: text("created_ip").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("api_keys_hash_idx").on(t.hash)],
);

/** One row per public API call: rate limits and the usage page read from here. */
export const apiRequests = pgTable("api_requests", {
  id: serial("id").primaryKey(),
  keyId: integer("key_id").references(() => apiKeys.id),
  /** Hashed client IP for calls without a key (the demo tier). */
  client: text("client").notNull().default(""),
  endpoint: text("endpoint").notNull(),
  status: integer("status").notNull(),
  ms: integer("ms").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

/** One run of the outside checks: every failure case, the judges' path and the public API, run by Render Workflows (or locally). */
export const checkRuns = pgTable("check_runs", {
  id: serial("id").primaryKey(),
  /** render-workflow | local */
  source: text("source").notNull(),
  /** The Render Workflows task run id of the parent run, when it ran there. */
  runId: text("run_id").notNull().default(""),
  appUrl: text("app_url").notNull(),
  passed: integer("passed").notNull(),
  total: integer("total").notNull(),
  results: jsonb("results").notNull().default([]),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A giver's monthly gift: the same amount each month, routed again by the rules engine for that month's needs.
 * The giver reaches it by a secret link (/m/{token}); Giftwise keeps no payment method and never holds the money.
 */
export const monthlyGifts = pgTable("monthly_gifts", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  householdId: integer("household_id")
    .notNull()
    .references(() => households.id),
  giverName: text("giver_name").notNull().default(""),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  /** active | stopped */
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One month of a monthly gift: the split the rules chose that month, what changed and why, and the PayPal order that paid it. */
export const monthlyRuns = pgTable(
  "monthly_runs",
  {
    id: serial("id").primaryKey(),
    monthlyGiftId: integer("monthly_gift_id")
      .notNull()
      .references(() => monthlyGifts.id),
    month: text("month").notNull(),
    plan: jsonb("plan").notNull(),
    changes: jsonb("changes").notNull().default([]),
    orderId: text("order_id"),
    /** planned | paid */
    status: text("status").notNull().default("planned"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("monthly_runs_gift_month_idx").on(t.monthlyGiftId, t.month)],
);
