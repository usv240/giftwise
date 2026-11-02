import { audit } from "@/lib/audit";
import { resetSample } from "@/lib/households";

/** Reset the sample household's payments so the demo can be replayed. Sandbox records at PayPal are untouched. */
export async function POST() {
  await resetSample();
  await audit("person", "demo.reset", "household:maya");
  return Response.json({ data: { reset: true }, error: null });
}
