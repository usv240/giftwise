// Talk to the Giftwise MCP server the way an agent's MCP client does, and print what comes back.
// Usage: npx tsx scripts/mcp-smoke.ts [base-url]
const BASE = process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:3100";
let id = 0;

async function rpc(method: string, params?: Record<string, unknown>) {
  const r = await fetch(`${BASE}/api/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
}

async function main() {
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "giftwise-smoke", version: "1" } });
  console.log("initialize:", init.serverInfo.name, init.protocolVersion);
  const note = await fetch(`${BASE}/api/mcp`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) });
  console.log("notification status:", note.status);
  const { tools } = await rpc("tools/list");
  console.log("tools:", tools.map((t: { name: string }) => t.name).join(", "));
  for (const [name, args] of [
    ["check_gift", { amount: 300, delivery: "cash", category: "personal" }],
    ["get_gift_page", { slug: "maya" }],
    ["plan_gift", { slug: "maya", amount: 500 }],
    ["get_gift_page", { slug: "nobody-here" }],
    ["check_gift", { amount: "lots" }],
  ] as const) {
    const r = await rpc("tools/call", { name, arguments: args });
    console.log(`\n${name}${r.isError ? " (error)" : ""}: ${r.content[0].text.slice(0, 400)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
