import type Anthropic from "@anthropic-ai/sdk";
import { AiUnavailableError, MODEL, claude } from "@/lib/ai/claude";

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
Keep the final answer short and warm: what cash would do, what you suggest instead, and the link. Plain text, no emoji.`;

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

export async function runAgentDemo(origin: string, asks = DEMO_ASKS) {
  const c = claude();
  if (!c) throw new AiUnavailableError();
  const mcp = new McpClient(`${origin}/api/mcp`);
  await mcp.rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "june-assistant", version: "1" } });
  const listed = (await mcp.rpc("tools/list")).tools as { name: string; description: string; inputSchema: Anthropic.Tool.InputSchema }[];
  const tools: Anthropic.Tool[] = listed.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema }));

  const steps: Step[] = [];
  const messages: Anthropic.MessageParam[] = [];
  const started = Date.now();
  for (const ask of asks) {
    steps.push({ kind: "ask", text: ask });
    messages.push({ role: "user", content: ask });
    await converse(c, tools, messages, steps, mcp);
  }
  return { steps, model: MODEL, tools: listed.map((t) => t.name), ms: Date.now() - started };
}

/** One user turn: call tools over MCP until the assistant answers. */
async function converse(c: Anthropic, tools: Anthropic.Tool[], messages: Anthropic.MessageParam[], steps: Step[], mcp: McpClient) {
  for (let turn = 0; turn < 8; turn++) {
    const res = await c.messages.create({ model: MODEL, max_tokens: 8000, system: SYSTEM, tools, messages, thinking: { type: "adaptive" } });
    for (const b of res.content) if (b.type === "text" && b.text.trim()) steps.push({ kind: "say", text: b.text.trim() });
    messages.push({ role: "assistant", content: res.content });
    if (res.stop_reason !== "tool_use") return;
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const b of res.content) {
      if (b.type !== "tool_use") continue;
      steps.push({ kind: "call", tool: b.name, input: b.input });
      const r = await mcp.rpc("tools/call", { name: b.name, arguments: b.input });
      const text = (r.content ?? []).map((x: { text?: string }) => x.text ?? "").join("\n");
      steps.push({ kind: "result", tool: b.name, text, isError: Boolean(r.isError) });
      results.push({ type: "tool_result", tool_use_id: b.id, content: text, is_error: Boolean(r.isError) });
    }
    messages.push({ role: "user", content: results });
  }
}
