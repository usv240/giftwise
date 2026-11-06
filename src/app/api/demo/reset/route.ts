import { audit } from "@/lib/audit";
import { resetSample } from "@/lib/households";
import { api } from "@/lib/api/handler";

/** Reset the sample household's payments so the demo can be replayed. Sandbox records at PayPal are untouched. */
async function postRoute() {
  await resetSample();
  await audit("person", "demo.reset", "household:maya");
  return Response.json({ data: { reset: true }, error: null });
}

export const POST = api("/api/demo/reset", postRoute);
