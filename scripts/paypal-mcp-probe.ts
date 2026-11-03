// Connect to PayPal's hosted sandbox MCP server, list its tools, and read one order with get_order.
// Usage: npx tsx --env-file=.env.local scripts/paypal-mcp-probe.ts [orderId]
import { PayPalMcp } from "../src/lib/agent/paypal-mcp";

async function main() {
  const mcp = await PayPalMcp.connect();
  try {
    const tools = await mcp.tools();
    console.log(`${tools.length} tools:`, tools.map((t) => t.name).join(", "));
    const go = tools.find((t) => t.name === "get_order");
    console.log("get_order input:", JSON.stringify(go?.inputSchema));
    const id = process.argv[2];
    if (id) {
      const r = await mcp.call("get_order", { id });
      console.log(r.isError ? "error" : "ok", (r.content[0]?.text ?? "").slice(0, 900));
    }
  } finally {
    mcp.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
