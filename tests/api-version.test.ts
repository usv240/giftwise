import { describe, expect, it } from "vitest";
import { ok } from "@/lib/api/envelope";
import { openapi } from "@/lib/api/openapi";
import { API_VERSION } from "@/lib/api/version";
import { serverCard } from "@/lib/mcp/card";
import { SERVER_INFO } from "@/lib/mcp/tools";

/** One version string: the OpenAPI document, every API envelope and the MCP server (and its Server Card) state the same one. */
describe("the published version", () => {
  it("is a date", () => {
    expect(API_VERSION).toMatch(/^20\d\d-\d\d-\d\d$/);
  });
  it("is the one the OpenAPI document, the API envelope and the MCP server all state", async () => {
    expect(openapi("https://giftwise.example.org").info.version).toBe(API_VERSION);
    const envelope = (await ok({ fine: true }, Date.now()).json()) as { meta: { version: string } };
    expect(envelope.meta.version).toBe(API_VERSION);
    expect(SERVER_INFO.version).toBe(API_VERSION);
    expect(serverCard("https://giftwise.example.org").version).toBe(API_VERSION);
  });
});
