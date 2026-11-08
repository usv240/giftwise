import { readdirSync, readFileSync, statSync } from "node:fs";
import { Environment } from "@paypal/paypal-server-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PAYPAL_HOSTS, paypalEnv, paypalHosts } from "@/lib/paypal/env";
import { sdkEnvironment } from "@/lib/paypal/client";
import { paypalMcpBase, paypalMcpEnvironment } from "@/lib/agent/paypal-mcp";

afterEach(() => vi.unstubAllEnvs());

describe("one PAYPAL_ENV setting for every PayPal address", () => {
  it("is the sandbox unless the setting says exactly live", () => {
    vi.stubEnv("PAYPAL_ENV", "");
    expect(paypalEnv()).toBe("sandbox");
    for (const v of [undefined, "", "sandbox", "SANDBOX", "production", "prod", "liv", "live-ish"]) expect(paypalEnv(v), String(v)).toBe("sandbox");
    for (const v of ["live", " LIVE ", "Live"]) expect(paypalEnv(v), v).toBe("live");
  });

  it("maps sandbox and live to PayPal's own addresses", () => {
    expect(PAYPAL_HOSTS.sandbox).toEqual({ api: "https://api-m.sandbox.paypal.com", sdk: "https://www.sandbox.paypal.com/web-sdk/v6/core", mcp: "https://mcp.sandbox.paypal.com", mcpEnvironment: "SANDBOX" });
    expect(PAYPAL_HOSTS.live).toEqual({ api: "https://api-m.paypal.com", sdk: "https://www.paypal.com/web-sdk/v6/core", mcp: "https://mcp.paypal.com", mcpEnvironment: "PRODUCTION" });
    expect(sdkEnvironment("sandbox")).toBe(Environment.Sandbox);
    expect(sdkEnvironment("live")).toBe(Environment.Production);
  });

  it("moves the REST base, the Server SDK and PayPal's MCP server together", () => {
    vi.stubEnv("PAYPAL_MCP_URL", undefined);
    vi.stubEnv("PAYPAL_ENV", "");
    expect([paypalHosts().api, sdkEnvironment(), paypalMcpBase(), paypalMcpEnvironment()]).toEqual(["https://api-m.sandbox.paypal.com", Environment.Sandbox, "https://mcp.sandbox.paypal.com", "SANDBOX"]);
    vi.stubEnv("PAYPAL_ENV", "live");
    expect([paypalHosts().api, sdkEnvironment(), paypalMcpBase(), paypalMcpEnvironment()]).toEqual(["https://api-m.paypal.com", Environment.Production, "https://mcp.paypal.com", "PRODUCTION"]);
  });

  it("gives the browser the same setting: next.config.ts copies PAYPAL_ENV, PayPalPay reads it", async () => {
    const config = (await import("../next.config")).default;
    expect(config.env?.NEXT_PUBLIC_PAYPAL_ENV).toBe(process.env.PAYPAL_ENV ?? "sandbox");
    expect(readFileSync("next.config.ts", "utf8")).toContain("NEXT_PUBLIC_PAYPAL_ENV: process.env.PAYPAL_ENV");
    expect(readFileSync("src/components/gift/PayPalPay.tsx", "utf8")).toContain("paypalHosts(paypalEnv(process.env.NEXT_PUBLIC_PAYPAL_ENV)).sdk");
  });

  it("is declared, as sandbox, in render.yaml and .env.example", () => {
    expect(readFileSync("render.yaml", "utf8")).toMatch(/- key: PAYPAL_ENV\b[^\n]*\n\s+value: sandbox\n/);
    expect(readFileSync(".env.example", "utf8")).toMatch(/^PAYPAL_ENV=sandbox$/m);
  });

  it("is the only source file that names a PayPal API, SDK or MCP host", () => {
    const own = new Set(["src/lib/paypal/env.ts", "tests/paypal-env.test.ts"]);
    // Any sandbox host, PayPal's live API and MCP hosts, and the JavaScript SDK's path. Links to PayPal's docs are fine.
    const host = /sandbox\.paypal\.com|(?:api-m|mcp)\.paypal\.com|paypal\.com\/web-sdk/;
    const code = /\.(ts|tsx|mts|cts|js|mjs|cjs)$/;
    const files: string[] = readdirSync(".").filter((f) => code.test(f) && statSync(f).isFile());
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
        const p = `${dir}/${name}`;
        if (statSync(p).isDirectory()) walk(p);
        else if (code.test(name)) files.push(p);
      }
    };
    for (const dir of ["src", "scripts", "workflows/src", "tests", "packages"]) walk(dir);
    expect(files.length).toBeGreaterThan(100);
    expect(files).toContain("src/lib/paypal/client.ts");
    expect(files.filter((f) => !own.has(f) && host.test(readFileSync(f, "utf8")))).toEqual([]);
  });
});
