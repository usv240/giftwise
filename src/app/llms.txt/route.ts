import { connection } from "next/server";
import { TOOLS, toolSummary } from "@/lib/mcp/tools";
import { publicOrigin } from "@/lib/origin";

/** GET /llms.txt: what Giftwise is and how an AI assistant can use it, in plain text. */
export async function GET(req: Request) {
  await connection();
  const o = publicOrigin(req);
  const tools = TOOLS.map((t) => `- ${t.name}: ${toolSummary(t)}`).join("\n");
  const text = `# Giftwise

> Benefit-safe giving for people who receive SSI (Supplemental Security Income). Giftwise checks each gift against Social Security's rules; one PayPal checkout pays the shops and clinics directly, and the share for the person's ABLE account goes through the ABLE plan's own gift page, so the monthly check stays whole. Every answer cites the regulation or SSA's operating manual. This deployment uses the PayPal sandbox.

Before suggesting cash for someone on SSI, check the gift first: cash counts as income, and help with rent or utilities counts even when paid to the landlord or utility.

## Connect

- MCP server (streamable HTTP): ${o}/api/mcp
- MCP Server Card: ${o}/api/mcp/server-card
- AI Catalog: ${o}/.well-known/ai-catalog.json
- REST API (OpenAPI 3.1): ${o}/openapi.json

## Tools

${tools}

## Learn

- [For AI agents](${o}/agents): install steps for Claude, Cursor and VS Code, and a live demo
- [The rules, explained](${o}/learn): each rule with its source
- [Evidence](${o}/evidence): results, live failure cases and test runs
`;
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
