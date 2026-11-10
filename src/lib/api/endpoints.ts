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
  /** For an upload: the sample file the playground sends when none is chosen, and the docs example names. */
  sample?: { path: string; file: string; type: string; label: string };
  ai?: boolean;
  keyed: boolean;
  /** Query parameters for GET endpoints. The first example values make the playground's request. */
  query?: { name: string; description: string; example?: string; enum?: string[] }[];
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
    summary:
      "Upload a photo or PDF of a bill (multipart field file). Claude reads it. A bill at or near housing, or one Claude is less than 90% sure of, also goes to the two reviewers, and the referee decides; then the rules engine picks the benefit-safe way to pay it.",
    upload: true,
    sample: { path: "/samples/northside-electric-bill.png", file: "northside-electric-bill.png", type: "image/png", label: "the sample electric bill" },
    ai: true,
    keyed: true,
  },
  {
    id: "read-letter",
    method: "POST",
    path: "/api/v1/read-letter",
    title: "Read a letter from Social Security",
    summary:
      "Upload a photo or PDF of the person's letter about their SSI payment (multipart field file, optional field pronoun). Claude reads the facts a gift page asks for, each with a short quote, and never returns an SSN, claim number, address or date of birth. The rules engine computes the check from those facts and compares it with the payment the letter states; for a PDF with a text layer, each quote is checked against the letter's text. Nothing is stored: send the confirmed answers as profile to /api/v1/gift-pages or PATCH /api/manage/{token}.",
    upload: true,
    sample: { path: "/samples/sam-ssa-letter-sample.pdf", file: "sam-ssa-letter-sample.pdf", type: "application/pdf", label: "the sample letter (made up for this demo)" },
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
    id: "ask-rules",
    method: "POST",
    path: "/api/v1/ask-rules",
    title: "Ask the rulebook",
    summary:
      "Ask a question about SSI and gifts in plain words. Elasticsearch finds the passages (hybrid keyword and semantic search with jina-embeddings-v3, reranked by jina-reranker-v3) across the regulations, SSA's operating manual and its worked examples; Claude answers from only those passages, and a program checks every quote word for word.",
    example: { question: "Does it count as income if my sister pays my phone bill?" },
    ai: true,
    keyed: true,
  },
  {
    id: "gift-pages",
    method: "POST",
    path: "/api/v1/gift-pages",
    title: "Create a gift page",
    summary:
      "Turn a list of needs, for example from a fundraiser, into a live gift page where every dollar is paid straight to the shop or the ABLE account through PayPal. The rules engine picks each route. Send the person's situation as profile and every check on the page uses it; without it the page names the sample situation it uses. Sandbox pages, five a day per visitor.",
    example: {
      name: "Jordan",
      pronoun: "they",
      organizer: "Sam",
      needs: [
        { title: "Van wheelchair lift", amount: 1800, category: "transport", vendor: "a van conversion shop" },
        { title: "Rent, December", amount: 650, category: "rent" },
      ],
      profile: { livesInAnothersHousehold: true, otherUnearnedMonthly: 600 },
      profile_source: "answers",
    },
    keyed: true,
  },
  {
    id: "ssa-report",
    method: "GET",
    path: "/api/v1/ssa-report",
    title: "Monthly report to SSA",
    summary:
      "One month of a gift page's gifts, written up as SSI reporting asks: what to tell Social Security by the 10th of the next month, and the PayPal capture or payout behind every gift that is not income. Add view=cash to see the report the same gifts would have needed as cash, or format=csv for a spreadsheet.",
    query: [
      { name: "page", description: 'Gift page id, the part after /g/. The sample page is "maya".', example: "maya" },
      { name: "month", description: "Income month, like 2026-10. Defaults to the month whose report is due next.", example: "2026-10" },
      { name: "view", description: '"given" (default) or "cash".', enum: ["given", "cash"] },
      { name: "format", description: "csv for a spreadsheet instead of JSON.", enum: ["csv"] },
    ],
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
