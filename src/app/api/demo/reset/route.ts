import { audit } from "@/lib/audit";
import { resetSample } from "@/lib/households";
import { api } from "@/lib/api/handler";

/**
 * Reopen the sample household's needs so the demo can be replayed. Earlier payments move to an earlier round rather than
 * being deleted, so every receipt still opens; sandbox records at PayPal are untouched.
 */
async function postRoute() {
  await resetSample();
  await audit("person", "demo.reset", "household:maya");
  return Response.json({ data: { reset: true }, error: null });
}

export const POST = api("/api/demo/reset", postRoute);
