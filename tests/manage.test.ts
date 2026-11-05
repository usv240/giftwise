import { describe, expect, it } from "vitest";
import { checkWebhookUrl, hashToken, newToken, routeNeed, signBody, verifySignature } from "@/lib/manage";

describe("the organizer's manage link", () => {
  it("is 24 random characters, stored only as a SHA-256", () => {
    const t = newToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(newToken()).not.toBe(t);
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).not.toContain(t);
  });

  it("lets the rules choose each need's route: housing to the ABLE account, everything else straight to the shop", () => {
    expect(routeNeed("Jordan", "they", { title: "Rent", amount: 800, category: "rent" })).toMatchObject({ route: "able", payeeName: "Jordan's ABLE account", payeeAccount: "able" });
    expect(routeNeed("Jordan", "they", { title: "Lift", amount: 1800, category: "equipment", vendor: "a van conversion shop" })).toMatchObject({ route: "vendor", payeeName: "Van conversion shop" });
    expect(routeNeed("Jordan", "they", { title: "Rent", amount: 800, category: "rent" }).detail).toMatch(/their ABLE account/);
  });
});

describe("gift notifications", () => {
  it("only go to public HTTPS addresses", async () => {
    for (const bad of ["http://hooks.example.com/x", "https://10.0.0.5/hook", "https://169.254.169.254/latest", "https://localhost/hook", "https://db.internal/x", "https://user:pw@hooks.example.com/x", "https://[::1]/x", "not a url"]) {
      expect((await checkWebhookUrl(bad)).ok, bad).toBe(false);
    }
  });

  it("are signed, and a receiver can check the signature, the body and the time", () => {
    const secret = "whsec_test";
    const body = JSON.stringify({ event: "gift.test", gift: { amount: 50 } });
    const t = 1_800_000_000;
    const header = signBody(secret, body, t);
    expect(header).toMatch(/^t=1800000000,v1=[0-9a-f]{64}$/);
    expect(verifySignature(secret, body, header, t + 10)).toBe(true);
    expect(verifySignature(secret, body + " ", header, t + 10)).toBe(false);
    expect(verifySignature("whsec_other", body, header, t + 10)).toBe(false);
    expect(verifySignature(secret, body, header, t + 3600)).toBe(false);
  });
});
