/**
 * A small client for PayPal's own hosted MCP server (the remote server behind PayPal's Agent Toolkit), over its
 * HTTP + SSE transport, with no extra packages. The assistant on /agents uses it to read an order straight from PayPal,
 * so the giver can check what Giftwise says against PayPal's own record. Only read tools are offered to the model.
 *
 * Transport: GET {base}/sse opens an event stream whose first "endpoint" event names a URL; JSON-RPC requests are
 * POSTed there and the answers arrive on the stream, matched by id.
 */
import { accessToken } from "@/lib/paypal/client";

export const PAYPAL_MCP_BASE = process.env.PAYPAL_MCP_URL ?? "https://mcp.sandbox.paypal.com";
/** PayPal tools the assistant may call. Reading an order changes nothing. */
export const PAYPAL_READ_TOOLS = new Set(["get_order"]);

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };
export type McpTool = { name: string; description?: string; inputSchema: Record<string, unknown> };

export class PayPalMcp {
  private postUrl: string | null = null;
  private pending = new Map<number, Pending>();
  private id = 0;
  private abort = new AbortController();

  private constructor(private token: string) {}

  static async connect(timeoutMs = 15_000) {
    const c = new PayPalMcp(await accessToken());
    await c.open(timeoutMs);
    await c.request("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "giftwise-assistant", version: "1" } });
    await c.notify("notifications/initialized");
    return c;
  }

  private async open(timeoutMs: number) {
    const res = await fetch(`${PAYPAL_MCP_BASE}/sse`, { headers: { accept: "text/event-stream", authorization: `Bearer ${this.token}` }, signal: this.abort.signal });
    if (!res.ok || !res.body) throw new Error(`PayPal MCP server answered ${res.status}`);
    const reader = res.body.getReader();
    const ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("PayPal MCP server sent no endpoint")), timeoutMs);
      void this.pump(reader, () => {
        clearTimeout(timer);
        resolve();
      });
    });
    await ready;
  }

  /** Read the event stream: the endpoint event once, then JSON-RPC answers. */
  private async pump(reader: ReadableStreamDefaultReader<Uint8Array>, onEndpoint: () => void) {
    const dec = new TextDecoder();
    let buf = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let cut: number;
        while ((cut = buf.indexOf("\n\n")) >= 0) {
          const raw = buf.slice(0, cut);
          buf = buf.slice(cut + 2);
          const event = /^event: ?(.*)$/m.exec(raw)?.[1]?.trim() ?? "message";
          const data = raw
            .split("\n")
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.slice(5).replace(/^ /, ""))
            .join("\n");
          if (event === "endpoint") {
            this.postUrl = new URL(data, PAYPAL_MCP_BASE).toString();
            onEndpoint();
          } else if (data) {
            const msg = JSON.parse(data) as { id?: number; result?: unknown; error?: { message?: string } };
            const p = msg.id !== undefined ? this.pending.get(msg.id) : undefined;
            if (p) {
              this.pending.delete(msg.id!);
              if (msg.error) p.reject(new Error(msg.error.message ?? "PayPal MCP error"));
              else p.resolve(msg.result);
            }
          }
        }
      }
    } catch (e) {
      if (!this.abort.signal.aborted) for (const p of this.pending.values()) p.reject(e as Error);
    }
  }

  private async post(body: unknown) {
    if (!this.postUrl) throw new Error("PayPal MCP session is not open");
    const r = await fetch(this.postUrl, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${this.token}` }, body: JSON.stringify(body) });
    if (!r.ok && r.status !== 202) throw new Error(`PayPal MCP server answered ${r.status}`);
  }

  request<T = unknown>(method: string, params?: Record<string, unknown>, timeoutMs = 30_000): Promise<T> {
    const id = ++this.id;
    const answer = new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`PayPal MCP ${method} timed out`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v as T);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
    });
    return this.post({ jsonrpc: "2.0", id, method, params }).then(() => answer);
  }

  notify(method: string, params?: Record<string, unknown>) {
    return this.post({ jsonrpc: "2.0", method, params });
  }

  async tools(): Promise<McpTool[]> {
    const r = await this.request<{ tools: McpTool[] }>("tools/list", {});
    return r.tools;
  }

  async call(name: string, args: Record<string, unknown>) {
    if (!PAYPAL_READ_TOOLS.has(name)) throw new Error(`${name} is not a read tool`);
    return this.request<{ content: { type: string; text?: string }[]; isError?: boolean }>("tools/call", { name, arguments: args });
  }

  close() {
    this.abort.abort();
  }
}
