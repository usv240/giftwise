import { openapi } from "@/lib/api/openapi";

/** GET /openapi.json: the API description, generated from the Zod schemas. */
export function GET(req: Request) {
  return Response.json(openapi(new URL(req.url).origin), { headers: { "Access-Control-Allow-Origin": "*" } });
}
