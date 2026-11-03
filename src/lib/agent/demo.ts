import type Anthropic from "@anthropic-ai/sdk";
import { AiUnavailableError, MODEL, claude } from "@/lib/ai/claude";
import { paypalRest } from "@/lib/paypal/client";
import { PayPalMcp } from "./paypal-mcp";

/**
 * An outside AI assistant that knows nothing about SSI, connected to Giftwise only through its public MCP server.
 * It discovers the tools over MCP, and every tool call it makes goes over MCP too. Used for the recorded demo and the
 * live run on the For agents page.
 */
export type Step =
  | { kind: "ask"; text: string }
  | { kind: "say"; text: string }
  | { kind: "call"; tool: string; input: unknown }
  | { kind: "result"; tool: string; text: string; isError: boolean };

export const DEMO_ASKS = [
  "I'm June, Maya's aunt. Her birthday is this week and I want to give her $300. Should I just send her the cash? She's on SSI, and her family made a Giftwise page for her: maya.",
  "That makes sense. Yes, please set up the $300 that way.",
];

const SYSTEM = `You are June's personal assistant. You can use the Giftwise tools, which are connected over MCP.
Check before advising on any gift to someone who receives SSI. Suggest a plan first and ask June whether to go ahead; start a PayPal checkout only after she says yes. Only June can approve it in PayPal, so give her the link and never claim the payment is done.
After you start a checkout, read the order with paypal_get_order, which comes from PayPal, not Giftwise, and tell June in one sentence what PayPal's own record says it will pay, how much, and that it waits for her approval. The record is PayPal's whichever way it was read. In the sandbox every shop shares one test business account, so do not try to match account names.
Keep the final answer short and warm: what cash would do, what you suggest instead, and the link. Say exactly what changes: her monthly check, from what to what. Cash does not go to Social Security; it lowers her check. Plain text, no emoji.`;

class McpClient {
  private id = 0;
  constructor(private url: string) {}
  async rpc(method: string, params?: Record<string, unknown>) {
    const r = await fetch(this.url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++this.id, method, params }),
    });
    const j = await r.json();
    if (j.error) throw new Error(`${method}: ${j.error.message ?? j.error.code}`);
    return j.result;
  }
}

/** PayPal's own get_order tool, with the input schema PayPal's MCP server publishes for it. Read only. */
export const PAYPAL_ORDER_TOOL: Anthropic.Tool = {
  name: "paypal_get_order",
  description:
    "Read an order straight from PayPal: its status, and each purchase unit's amount and payee. This is PayPal's own record, not Giftwise's. Use it after start_gift_checkout to confirm who the order pays.",
  input_schema: { type: "object", properties: { id: { type: "string", pattern: "^[A-Z0-9]{17,32}$", description: "The PayPal order id" } }, required: ["id"] },
};

type PayPalOrder = {
  id: string;
  status: string;
  purchase_units?: { reference_id?: string; description?: string; amount?: { value?: string }; payee?: { merchant_id?: string; email_address?: string } }[];
};
/** The payee as PayPal names it: a merchant ID, or the account's email with most of the name hidden. */
const payeeLabel = (p?: { merchant_id?: string; email_address?: string }) => {
  if (p?.merchant_id) return `merchant ${p.merchant_id}`;
  const [user, domain] = (p?.email_address ?? "").split("@");
  return domain ? `${user.slice(0, 3)}...@${domain}` : "not shown";
};
const summarize = (o: PayPalOrder, source: string) =>
  JSON.stringify({
    source,
    id: o.id,
    status: o.status,
    purchase_units: (o.purchase_units ?? []).map((u) => ({ reference_id: u.reference_id, for: u.description, amount: u.amount?.value, paid_to_paypal_account: payeeLabel(u.payee) })),
  });

/**
 * Ask PayPal's hosted MCP server first (its get_order tool). When that server cannot run the call, read the same order
 * from PayPal's Orders API and say so. Either way the answer is PayPal's record, not Giftwise's.
 */
async function readPayPalOrder(id: string, session: { mcp?: PayPalMcp | null }) {
  let mcpNote = "";
  try {
    session.mcp ??= await PayPalMcp.connect();
    const r = await session.mcp.call("get_order", { id });
    const parsed = JSON.parse(r.content.map((x) => x.text ?? "").join("")) as PayPalOrder & { ok?: boolean; code?: string };
    if (!r.isError && parsed.ok !== false && parsed.id) return { text: summarize(parsed, "PayPal MCP server, get_order"), isError: false };
    mcpNote = parsed.code ?? "an error";
  } catch (e) {
    session.mcp = null;
    mcpNote = (e as Error).message.slice(0, 80);
  }
  const res = await paypalRest<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(id)}`, { method: "GET" });
  if (res.status !== 200) return { text: `PayPal could not find order ${id} (HTTP ${res.status}).`, isError: true };
  return { text: summarize(res.body, `PayPal's own record, read from the PayPal Orders API (GET /v2/checkout/orders/{id}) because PayPal's hosted MCP server could not run get_order (${mcpNote}).`), isError: false };
}

export async function runAgentDemo(origin: string, asks = DEMO_ASKS) {
  const c = claude();
  if (!c) throw new AiUnavailableError();
  const mcp = new McpClient(`${origin}/api/mcp`);
  await mcp.rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "june-assistant", version: "1" } });
  const listed = (await mcp.rpc("tools/list")).tools as { name: string; description: string; inputSchema: Anthropic.Tool.InputSchema }[];
  const tools: Anthropic.Tool[] = [...listed.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema })), PAYPAL_ORDER_TOOL];
  const paypal: { mcp?: PayPalMcp | null } = {};

  const steps: Step[] = [];
  const messages: Anthropic.MessageParam[] = [];
  const started = Date.now();
  for (const ask of asks) {
    steps.push({ kind: "ask", text: ask });
    messages.push({ role: "user", content: ask });
    await converse(c, tools, messages, steps, mcp, paypal);
  }
  paypal.mcp?.close();
  return { steps, model: MODEL, tools: [...listed.map((t) => t.name), PAYPAL_ORDER_TOOL.name], ms: Date.now() - started };
}

/** One user turn: call tools over MCP until the assistant answers. */
async function converse(c: Anthropic, tools: Anthropic.Tool[], messages: Anthropic.MessageParam[], steps: Step[], mcp: McpClient, paypal: { mcp?: PayPalMcp | null }) {
  for (let turn = 0; turn < 8; turn++) {
    const res = await c.messages.create({ model: MODEL, max_tokens: 8000, system: SYSTEM, tools, messages, thinking: { type: "adaptive" } });
    for (const b of res.content) if (b.type === "text" && b.text.trim()) steps.push({ kind: "say", text: b.text.trim() });
    messages.push({ role: "assistant", content: res.content });
    if (res.stop_reason !== "tool_use") return;
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const b of res.content) {
      if (b.type !== "tool_use") continue;
      steps.push({ kind: "call", tool: b.name, input: b.input });
      const { text, isError } =
        b.name === PAYPAL_ORDER_TOOL.name
          ? await readPayPalOrder(String((b.input as { id?: string }).id ?? ""), paypal)
          : await mcp.rpc("tools/call", { name: b.name, arguments: b.input }).then((r) => ({ text: (r.content ?? []).map((x: { text?: string }) => x.text ?? "").join("\n"), isError: Boolean(r.isError) }));
      steps.push({ kind: "result", tool: b.name, text, isError });
      results.push({ type: "tool_result", tool_use_id: b.id, content: text, is_error: isError });
    }
    messages.push({ role: "user", content: results });
  }
}
