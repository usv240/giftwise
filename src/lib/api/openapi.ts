import { z } from "zod";
import { RULES_VERSION } from "../rules";
import { CheckGiftData } from "./check-gift";
import { ENDPOINTS, ERRORS } from "./endpoints";
import { API_VERSION } from "./version";
import { AnalyzeFundraiserRequest, CheckGiftRequest, GiftPageRequest, KeyRequest, ManagePageRequest, PlanMonthRequest, ReviewBillRequest, AskRulesRequest } from "./schemas";

const json = (s: z.ZodType) => {
  const { $schema: _drop, ...rest } = z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;
  void _drop;
  return rest;
};

/** The check-gift answer's fields; the four kept for version 1 are marked deprecated, each naming the field that replaces it. */
export function checkGiftDataSchema() {
  const { $schema: _drop, ...rest } = z.toJSONSchema(CheckGiftData, { io: "output" }) as Record<string, unknown> & { properties: Record<string, Record<string, unknown>> };
  void _drop;
  for (const k of ["savings_on_next_first", "over_savings_limit", "able_balance_on_next_first", "resource_status"]) rest.properties[k] = { ...rest.properties[k], deprecated: true };
  return rest;
}

/** Answers with their own schema: the envelope with data described. */
const DATA: Record<string, string> = { "check-gift": "CheckGiftData" };

const BODIES: Record<string, Record<string, unknown>> = {
  "check-gift": json(CheckGiftRequest),
  "plan-month": json(PlanMonthRequest),
  "analyze-fundraiser": json(AnalyzeFundraiserRequest),
  "review-bill": json(ReviewBillRequest),
  "ask-rules": json(AskRulesRequest),
  "gift-pages": json(GiftPageRequest),
};

/** OpenAPI 3.1, generated from the same Zod schemas the endpoints validate with. */
export function openapi(server: string) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const e of ENDPOINTS) {
    const op: Record<string, unknown> = {
      operationId: e.id.replace(/-(\w)/g, (_, c: string) => c.toUpperCase()),
      summary: e.title,
      description: e.summary,
      tags: [e.keyed ? "Checks" : "Utilities"],
      security: e.keyed ? [{ apiKey: [] }, {}] : [],
      responses: {
        "200": {
          description: "Success. The answer is in data; meta has request_id, version, rules_version and latency_ms.",
          content: { "application/json": { schema: DATA[e.id] ? { allOf: [{ $ref: "#/components/schemas/Envelope" }, { type: "object", properties: { data: { $ref: `#/components/schemas/${DATA[e.id]}` } } }] } : { $ref: "#/components/schemas/Envelope" } } },
        },
        ...(e.keyed ? { "429": { $ref: "#/components/responses/RateLimited" } } : {}),
        default: { $ref: "#/components/responses/Error" },
      },
    };
    if (e.query) op.parameters = e.query.map((p) => ({ name: p.name, in: "query", description: p.description, schema: { type: "string", ...(p.enum ? { enum: p.enum } : {}), ...(p.example ? { example: p.example } : {}) } }));
    if (e.path.includes("{id}")) op.parameters =[{ name: "id", in: "path", required: true, schema: { type: "string" } }, { name: "format", in: "query", schema: { type: "string", enum: ["csv"] } }];
    if (BODIES[e.id]) op.requestBody = { required: true, content: { "application/json": { schema: BODIES[e.id], example: e.example } } };
    if (e.upload) {
      op.requestBody = {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              required: ["file"],
              properties: {
                file: { type: "string", format: "binary", description: "JPEG, PNG, WebP or PDF, up to 10 MB." },
                ...(e.id === "read-letter" ? { pronoun: { type: "string", enum: ["she", "he", "they"], description: "How the answer refers to the person. Optional; she/her when left out." } } : {}),
              },
            },
          },
        },
      };
    }
    paths[e.path] = { [e.method.toLowerCase()]: op };
  }
  // The organizer's private manage link: the token in the path is the only key to the page (no account, no API key).
  const token = { name: "token", in: "path", required: true, description: "The page's private manage token, from manage_url when the page was made.", schema: { type: "string" } };
  paths["/api/manage/{token}"] = {
    get: {
      operationId: "getManagedPage",
      summary: "Read a page you organize",
      description: "The page, its needs and the gifts received, with the person's situation (situation: own or sample, and the profile every check on the page uses) and their check with no gift.",
      tags: ["Manage"],
      parameters: [token],
      responses: { "200": { description: "The page as its organizer sees it.", content: { "application/json": { schema: { $ref: "#/components/schemas/Envelope" } } } }, default: { $ref: "#/components/responses/Error" } },
    },
    patch: {
      operationId: "updateManagedPage",
      summary: "Change a page you organize",
      description:
        "Change the note, close or reopen the page, or set the person's situation: profile with the fields you know (the rest keep the sample situation's values), or null to go back to the sample situation. Only these confirmed facts are saved; a letter read with /api/v1/read-letter is never stored.",
      tags: ["Manage"],
      parameters: [token],
      requestBody: { required: true, content: { "application/json": { schema: json(ManagePageRequest), example: { profile: { livesInAnothersHousehold: true, otherUnearnedMonthly: 600 }, profile_source: "letter" } } } },
      responses: { "200": { description: "The page's status, note, situation, profile and check.", content: { "application/json": { schema: { $ref: "#/components/schemas/Envelope" } } } }, default: { $ref: "#/components/responses/Error" } },
    },
  };
  paths["/api/keys"] = {
    post: {
      operationId: "createKey",
      summary: "Create a sandbox API key",
      description: "Returns the full key once. Only its SHA-256 hash is stored. Limits: 5 new keys per client and 3 per email each day.",
      tags: ["Keys"],
      requestBody: { required: true, content: { "application/json": { schema: json(KeyRequest) } } },
      responses: { "200": { description: "The new key, shown once.", content: { "application/json": { schema: { $ref: "#/components/schemas/Envelope" } } } }, default: { $ref: "#/components/responses/Error" } },
    },
  };

  return {
    openapi: "3.1.0",
    info: {
      title: "Giftwise API",
      version: API_VERSION,
      description: `Benefit-safe giving checks for people who receive SSI. Rules version ${RULES_VERSION}. Every answer cites the regulation or SSA's operating manual. Sandbox only: no real money and no real personal data.`,
    },
    servers: [{ url: server }],
    tags: [
      { name: "Checks", description: "The rules engine and the AI readers. A key is optional; with one you get higher limits and usage." },
      { name: "Utilities", description: "Presets, the ledger check and service status." },
      { name: "Keys", description: "Free sandbox keys." },
      { name: "Manage", description: "A page's organizer, through its private manage link: the needs, the note, and the person's situation." },
    ],
    paths,
    components: {
      securitySchemes: { apiKey: { type: "http", scheme: "bearer", description: "A gw_test_ key from the Developers page." } },
      schemas: {
        CheckGiftData: checkGiftDataSchema(),
        Envelope: {
          type: "object",
          properties: {
            data: { description: "The answer. Null on error." },
            meta: { type: "object", properties: { request_id: { type: "string" }, version: { type: "string" }, rules_version: { type: "string" }, latency_ms: { type: "integer" } } },
            error: { $ref: "#/components/schemas/Error" },
          },
        },
        Error: {
          type: ["object", "null"],
          properties: {
            code: { type: "string", enum: ERRORS.map((x) => x.code) },
            message: { type: "string", description: "A plain sentence you can show to people." },
            docs: { type: "string" },
            details: {},
          },
        },
      },
      responses: {
        Error: { description: "An error, with a plain message.", content: { "application/json": { schema: { $ref: "#/components/schemas/Envelope" } } } },
        RateLimited: {
          description: "Too many requests. Retry after the number of seconds in Retry-After.",
          headers: { "Retry-After": { schema: { type: "integer" } } },
          content: { "application/json": { schema: { $ref: "#/components/schemas/Envelope" } } },
        },
      },
    },
  };
}
