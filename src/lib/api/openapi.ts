import { z } from "zod";
import { RULES_VERSION } from "../rules";
import { ENDPOINTS, ERRORS } from "./endpoints";
import { AnalyzeFundraiserRequest, CheckGiftRequest, KeyRequest, PlanMonthRequest, ReviewBillRequest } from "./schemas";

const json = (s: z.ZodType) => {
  const { $schema: _drop, ...rest } = z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;
  void _drop;
  return rest;
};

const BODIES: Record<string, Record<string, unknown>> = {
  "check-gift": json(CheckGiftRequest),
  "plan-month": json(PlanMonthRequest),
  "analyze-fundraiser": json(AnalyzeFundraiserRequest),
  "review-bill": json(ReviewBillRequest),
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
        "200": { description: "Success. The answer is in data; meta has request_id, version, rules_version and latency_ms.", content: { "application/json": { schema: { $ref: "#/components/schemas/Envelope" } } } },
        ...(e.keyed ? { "429": { $ref: "#/components/responses/RateLimited" } } : {}),
        default: { $ref: "#/components/responses/Error" },
      },
    };
    if (e.path.includes("{id}")) op.parameters = [{ name: "id", in: "path", required: true, schema: { type: "string" } }, { name: "format", in: "query", schema: { type: "string", enum: ["csv"] } }];
    if (BODIES[e.id]) op.requestBody = { required: true, content: { "application/json": { schema: BODIES[e.id], example: e.example } } };
    if (e.upload) {
      op.requestBody = {
        required: true,
        content: { "multipart/form-data": { schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary", description: "JPEG, PNG, WebP or PDF, up to 10 MB." } } } } },
      };
    }
    paths[e.path] = { [e.method.toLowerCase()]: op };
  }
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
      version: "2026-11-01",
      description: `Benefit-safe giving checks for people who receive SSI. Rules version ${RULES_VERSION}. Every answer cites the regulation or SSA's operating manual. Sandbox only: no real money and no real personal data.`,
    },
    servers: [{ url: server }],
    tags: [
      { name: "Checks", description: "The rules engine and the AI readers. A key is optional; with one you get higher limits and usage." },
      { name: "Utilities", description: "Presets, the ledger check and service status." },
      { name: "Keys", description: "Free sandbox keys." },
    ],
    paths,
    components: {
      securitySchemes: { apiKey: { type: "http", scheme: "bearer", description: "A gw_test_ key from the Developers page." } },
      schemas: {
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
