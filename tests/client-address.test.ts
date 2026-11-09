import { describe, expect, it } from "vitest";
import { clientAddress, clientId } from "@/lib/api/keys";

const req = (h: Record<string, string>) => new Request("http://localhost/api/x", { headers: h });

describe("the caller's address", () => {
  it("ignores a chosen X-Forwarded-For when Cloudflare's header is present", () => {
    const a = req({ "cf-connecting-ip": "203.0.113.9", "x-forwarded-for": "198.51.100.1, 203.0.113.9" });
    expect(clientAddress(a)).toEqual({ ip: "203.0.113.9", source: "cf-connecting-ip" });
    const b = req({ "cf-connecting-ip": "203.0.113.9", "x-forwarded-for": "192.0.2.77, 203.0.113.9" });
    expect(clientId(a)).toBe(clientId(b));
  });

  it("reads the headers in order: cf-connecting-ip, true-client-ip, X-Forwarded-For, x-real-ip", () => {
    expect(clientAddress(req({ "true-client-ip": "203.0.113.5", "x-forwarded-for": "198.51.100.1" })).source).toBe("true-client-ip");
    expect(clientAddress(req({ "x-forwarded-for": " 198.51.100.1 , 10.0.0.1", "x-real-ip": "10.0.0.2" }))).toEqual({ ip: "198.51.100.1", source: "x-forwarded-for" });
    expect(clientAddress(req({ "x-real-ip": "10.0.0.2" })).source).toBe("x-real-ip");
    expect(clientAddress(req({}))).toEqual({ ip: "local", source: "none" });
  });

  it("gives different callers different ids and never returns the raw address", () => {
    const one = clientId(req({ "cf-connecting-ip": "203.0.113.9" }));
    const two = clientId(req({ "cf-connecting-ip": "203.0.113.10" }));
    expect(one).not.toBe(two);
    expect(one).not.toContain("203.0.113");
  });
});
