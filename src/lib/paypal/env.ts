/**
 * Which PayPal Giftwise talks to, from one setting: PAYPAL_ENV, "sandbox" (the default) or "live". Every PayPal address
 * the app uses comes from this file: the REST base, the Server SDK's environment (src/lib/paypal/client.ts), the
 * JavaScript SDK the browser loads (src/components/gift/PayPalPay.tsx) and PayPal's MCP server
 * (src/lib/agent/paypal-mcp.ts). tests/paypal-env.test.ts fails if any other source file names a PayPal host.
 *
 * Only the exact word "live" moves real money; any other value stays in the sandbox. The browser cannot read PAYPAL_ENV,
 * so next.config.ts copies it into NEXT_PUBLIC_PAYPAL_ENV when the app is built, the same way the browser's client ID is.
 * No imports, so the browser bundle can use it.
 */
export type PayPalEnv = "sandbox" | "live";

export const PAYPAL_HOSTS = {
  sandbox: {
    /** Orders, Payments, Payouts, Transaction Search and OAuth. */
    api: "https://api-m.sandbox.paypal.com",
    /** The JavaScript SDK v6 core script. */
    sdk: "https://www.sandbox.paypal.com/web-sdk/v6/core",
    /** PayPal's hosted MCP server. */
    mcp: "https://mcp.sandbox.paypal.com",
    /** What PayPal's @paypal/mcp package reads from PAYPAL_ENVIRONMENT. */
    mcpEnvironment: "SANDBOX",
  },
  live: {
    api: "https://api-m.paypal.com",
    sdk: "https://www.paypal.com/web-sdk/v6/core",
    mcp: "https://mcp.paypal.com",
    mcpEnvironment: "PRODUCTION",
  },
} as const satisfies Record<PayPalEnv, { api: string; sdk: string; mcp: string; mcpEnvironment: string }>;

/** The setting as Giftwise reads it. On the server pass nothing; in the browser pass process.env.NEXT_PUBLIC_PAYPAL_ENV. */
export function paypalEnv(value: string | undefined = process.env.PAYPAL_ENV): PayPalEnv {
  return value?.trim().toLowerCase() === "live" ? "live" : "sandbox";
}

/** Every PayPal address for one environment. */
export const paypalHosts = (env: PayPalEnv = paypalEnv()) => PAYPAL_HOSTS[env];
