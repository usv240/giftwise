/** The public API, as plain data: the playground, the docs page and /openapi.json all read from here. Client-safe. */
export type Endpoint = {
  id: string;
  method: "GET" | "POST";
  path: string;
  title: string;
  summary: string;
  /** JSON body for the playground and the docs example. Absent for GET and for file uploads. */
  example?: unknown;
  upload?: boolean;
  ai?: boolean;
  keyed: boolean;
};

export const ENDPOINTS: Endpoint[] = [
  {
    id: "check-gift",
    method: "POST",
    path: "/api/v1/check-gift",
    title: "Check a gift",
    summary: "How one gift changes her SSI check, the benefit-safe way to give it, and the rules and sources behind the answer.",
    example: { gift: { amount: 1000, delivery: "cash", category: "other", date: "2026-04-10" }, profile: { savings: 1240 } },
    keyed: true,
  },
  {
    id: "plan-month",
    method: "POST",
    path: "/api/v1/plan-month",
    title: "Plan several gifts",
    summary: "Many gifts over several months, counted the way Social Security counts them: monthly, with the quarterly exclusion shared.",
    example: {
      gifts: [
        { date: "2026-04-05", amount: 50, delivery: "cash", giver: "Ana" },
        { date: "2026-06-25", amount: 50, delivery: "cash", giver: "Ben" },
        { date: "2026-06-26", amount: 420, delivery: "vendor", category: "equipment", giver: "Dan" },
      ],
    },
    keyed: true,
  },
  {
    id: "read-bill",
    method: "POST",
    path: "/api/v1/read-bill",
    title: "Read a bill",
    summary: "Upload a photo or PDF of a bill (multipart field file). Claude reads it, then the rules engine checks the benefit-safe way to pay it.",
    upload: true,
    ai: true,
    keyed: true,
  },
  {
    id: "analyze-fundraiser",
    method: "POST",
    path: "/api/v1/analyze-fundraiser",
    title: "Read a fundraiser",
    summary: "Read a public fundraiser page and plan how each use of the money can reach her without lowering her check.",
    example: { url: "/samples/fundraiser.html" },
    ai: true,
    keyed: true,
  },
  {
    id: "review-bill",
    method: "POST",
    path: "/api/v1/review-bill",
    title: "Ask the two reviewers",
    summary:
      "Two Claude reviewers decide whether a bill paid by someone else is a housing cost. One reads the regulations and the Federal Register, the other SSA's operating manual, and each must quote its rulebook word for word. A program checks every quote, and the rules engine picks the route.",
    example: { description: "Northside Electric Co-op, residential electric service, monthly bill", amount: 138, category: "utility", recurring: true },
    ai: true,
    keyed: true,
  },
  {
    id: "gift-pages",
    method: "POST",
    path: "/api/v1/gift-pages",
    title: "Create a gift page",
    summary:
      "Turn a list of needs, for example from a fundraiser, into a live gift page where every dollar is paid straight to the shop or the ABLE account through PayPal. The rules engine picks each route. Sandbox pages, five a day per visitor.",
    example: { name: "Jordan", pronoun: "they", organizer: "Sam", needs: [{ title: "Van wheelchair lift", amount: 1800, category: "transport", vendor: "a van conversion shop" }, { title: "Rent, December", amount: 650, category: "rent" }] },
    keyed: true,
  },
  {
    id: "presets",
    method: "GET",
    path: "/api/presets/{id}",
    title: "Download a preset",
    summary: "A sample case with its input and the engine's current answer. Add ?format=csv for gift lists. Ids: wheelchair-repair, birthday-cash, electric-bill, rent-help, laptop-college, groceries, van-fundraiser, march-month.",
    keyed: false,
  },
  {
    id: "ledger",
    method: "GET",
    path: "/api/ledger/verify",
    title: "Verify the ledger",
    summary: "Recompute the audit ledger's SHA-256 hash chain from the first entry and report whether every entry still matches.",
    keyed: false,
  },
  {
    id: "health",
    method: "GET",
    path: "/api/health",
    title: "Service status",
    summary: "Whether PayPal, Claude, the database and each sponsor tool are live or using a fallback right now.",
    keyed: false,
  },
];

export const ERRORS = [
  { code: "invalid_request", status: "400, 409, 413, 422", plain: "Something in the request is missing or not valid. The message says what; details lists each field." },
  { code: "unauthorized", status: "401", plain: "The API key is not valid or was revoked. Create a new key on the Developers page." },
  { code: "not_found", status: "404", plain: "The thing you asked for does not exist, such as an unknown preset or order." },
  { code: "rate_limited", status: "429", plain: "Too many requests. Wait for the time in the Retry-After header. Keys allow 60 a minute and 1,000 a day." },
  { code: "upstream_unavailable", status: "502, 503", plain: "PayPal or the AI service did not answer, or is not connected on this server. The message says which." },
  { code: "internal", status: "500", plain: "Something went wrong on our side. The request id in meta helps us find it." },
] as const;
