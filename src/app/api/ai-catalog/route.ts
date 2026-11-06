import { connection } from "next/server";
import { CATALOG_TYPE, aiCatalog, discoveryOptions, discoveryResponse } from "@/lib/mcp/card";
import { publicOrigin } from "@/lib/origin";
import { api } from "@/lib/api/handler";

/** GET /.well-known/ai-catalog.json (rewritten here): the domain's AI Catalog, pointing to the MCP Server Card. */
async function getRoute(req: Request) {
  await connection();
  return discoveryResponse(req, aiCatalog(publicOrigin(req)), CATALOG_TYPE);
}
export const OPTIONS = discoveryOptions;

export const GET = api("/api/ai-catalog", getRoute);
