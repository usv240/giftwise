/**
 * Clients for PayPal's own MCP server, so the assistant on /agents can read an order straight from PayPal and the giver
 * can check what Giftwise says against PayPal's own record. The nightly card check (src/lib/card-check.ts) reads each
 * gift it pays back the same way. Only read tools are offered to the model.
 *
 * Two ways to reach the same server:
 * - Local (the default): PayPal's published server package, @paypal/mcp, run by Giftwise as a child process over stdio,
 *   with an access token and PAYPAL_ENVIRONMENT in its environment. This is PayPal's documented local setup.
 * - Hosted: PayPal's remote server over HTTP + SSE. GET {base}/sse opens an event stream whose first "endpoint" event
 *   names a URL; JSON-RPC requests are POSTed there and the answers arrive on the stream, matched by id. Its get_order
 *   answered PAYPAL_API_SETUP_ERROR for this sandbox app for a time (github.com/paypal/AI-Toolkit/issues/34) and
 *   answers with the order since November 8, 2026 (scripts/paypal-mcp-probe.ts). It is tried when the local server
 *   cannot start, or first when PAYPAL_MCP_MODE=hosted.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { accessToken } from "@/lib/paypal/client";
import { paypalHosts } from "@/lib/paypal/env";

/** PayPal's hosted server for this PAYPAL_ENV (src/lib/paypal/env.ts), unless PAYPAL_MCP_URL names another. */
export const paypalMcpBase = () => process.env.PAYPAL_MCP_URL ?? paypalHosts().mcp;
/** What the local @paypal/mcp server reads to pick PayPal's sandbox or live API. */
export const paypalMcpEnvironment = () => paypalHosts().mcpEnvironment;
/** PayPal tools the assistant may call. Reading an order changes nothing. */
export const PAYPAL_READ_TOOLS = new Set(["get_order"]);

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };
export type McpTool = { name: string; description?: string; inputSchema: Record<string, unknown> };

export type McpCallResult = { content: { type: string; text?: string }[]; isError?: boolean };
export interface PayPalMcpClient {
  /** Where the server runs, for the status page and the assistant's citation. */
  readonly via: "local" | "hosted";
  readonly version: string;
  tools(): Promise<McpTool[]>;
  call(name: string, args: Record<string, unknown>): Promise<McpCallResult>;
  close(): void;
}

/** The stdio transport sends one JSON-RPC message per line. */
const NL = String.fromCharCode(10);
const LOCAL_SERVER = path.join(process.cwd(), "node_modules", "@paypal", "mcp", "dist", "index.js");
const localVersion = () => {
  try {
    return (JSON.parse(readFileSync(path.join(process.cwd(), "node_modules", "@paypal", "mcp", "package.json"), "utf8")) as { version: string }).version;
  } catch {
    return "";
  }
};

/** PayPal's @paypal/mcp server, started as a child process and spoken to over stdio, one JSON-RPC message per line. */
export class PayPalMcpLocal implements PayPalMcpClient {
  readonly via = "local" as const;
  readonly version = localVersion();
  private pending = new Map<number, Pending>();
  private id = 0;
  private buf = "";

  private constructor(private child: ChildProcessWithoutNullStreams) {
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (d: string) => {
      this.buf += d;
      let cut: number;
      while ((cut = this.buf.indexOf(NL)) >= 0) {
        const line = this.buf.slice(0, cut).trim();
        this.buf = this.buf.slice(cut + 1);
        if (!line.startsWith("{")) continue;
        try {
          const msg = JSON.parse(line) as { id?: number; result?: unknown; error?: { message?: string } };
          const p = msg.id !== undefined ? this.pending.get(msg.id) : undefined;
          if (!p) continue;
          this.pending.delete(msg.id!);
          if (msg.error) p.reject(new Error(msg.error.message ?? "PayPal MCP error"));
          else p.resolve(msg.result);
        } catch {
          // Not a JSON-RPC line; the server logs to stderr, so this is rare.
        }
      }
    });
    // stderr is drained and dropped: it can echo configuration, and nothing in it is needed.
    child.stderr.on("data", () => {});
    child.on("exit", () => {
      for (const p of this.pending.values()) p.reject(new Error("PayPal MCP server stopped"));
      this.pending.clear();
    });
  }

  static available() {
    return existsSync(LOCAL_SERVER);
  }

  static async connect(timeoutMs = 20_000) {
    if (!PayPalMcpLocal.available()) throw new Error("@paypal/mcp is not installed");
    const token = await accessToken();
    // Only what the server needs: the token and the environment, never the client secret.
    const env: Record<string, string | undefined> = { PATH: process.env.PATH, HOME: process.env.HOME, SystemRoot: process.env.SystemRoot, PAYPAL_ACCESS_TOKEN: token, PAYPAL_ENVIRONMENT: paypalMcpEnvironment() };
    const child = spawn(process.execPath, [LOCAL_SERVER, "--tools=all"], { env: env as NodeJS.ProcessEnv, stdio: ["pipe", "pipe", "pipe"] });
    const c = new PayPalMcpLocal(child);
    try {
      await c.request("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "giftwise-assistant", version: "1" } }, timeoutMs);
      c.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + NL);
      return c;
    } catch (e) {
      c.close();
      throw e;
    }
  }

  private request<T = unknown>(method: string, params?: Record<string, unknown>, timeoutMs = 30_000): Promise<T> {
    const id = ++this.id;
    return new Promise<T>((resolve, reject) => {
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
      this.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + NL);
    });
  }

  async tools(): Promise<McpTool[]> {
    return (await this.request<{ tools: McpTool[] }>("tools/list", {})).tools;
  }

  async call(name: string, args: Record<string, unknown>) {
    if (!PAYPAL_READ_TOOLS.has(name)) throw new Error(`${name} is not a read tool`);
    return this.request<McpCallResult>("tools/call", { name, arguments: args });
  }

  close() {
    if (!this.child.killed) this.child.kill();
  }
}

/** Connect to PayPal's MCP server: the local package first, then PayPal's hosted server. */
export async function connectPayPalMcp(timeoutMs?: number): Promise<PayPalMcpClient> {
  if (process.env.PAYPAL_MCP_MODE !== "hosted" && PayPalMcpLocal.available()) {
    try {
      return await PayPalMcpLocal.connect(timeoutMs);
    } catch {
      // Fall through to the hosted server.
    }
  }
  return PayPalMcp.connect(timeoutMs);
}

export class PayPalMcp implements PayPalMcpClient {
  readonly via = "hosted" as const;
  readonly version = "";
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
    const res = await fetch(`${paypalMcpBase()}/sse`, { headers: { accept: "text/event-stream", authorization: `Bearer ${this.token}` }, signal: this.abort.signal });
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
            this.postUrl = new URL(data, paypalMcpBase()).toString();
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
    return this.request<McpCallResult>("tools/call", { name, arguments: args });
  }

  close() {
    this.abort.abort();
  }
}
