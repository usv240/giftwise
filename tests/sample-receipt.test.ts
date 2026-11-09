import { describe, expect, it } from "vitest";
import { SAMPLE } from "@/lib/households";
import { RECORDED_RECEIPT } from "@/lib/sample-receipt";

/**
 * The recorded sandbox receipt (content/sample-receipt.json) is seeded with the sample page as an earlier round, so its
 * receipt can be read on any deployment without paying. It must be a real captured PayPal order: ids in PayPal's shape,
 * every line captured, each need line pointing at a sample need, and nothing that looks like an address or a key.
 */
describe("the recorded sample receipt", () => {
  const r = RECORDED_RECEIPT;
  it("is one captured PayPal sandbox order", () => {
    expect(r.order_id).toMatch(/^[A-Z0-9]{17}$/);
    expect(r.lines.length).toBeGreaterThanOrEqual(2);
    for (const l of r.lines) {
      expect(l.capture_id, l.reference_id).toMatch(/^[A-Z0-9]{17}$/);
      expect(Number(l.amount)).toBeGreaterThan(0);
      expect(["vendor", "able"]).toContain(l.route);
    }
    expect(new Set(r.lines.map((l) => l.reference_id)).size).toBe(r.lines.length);
    expect(Number.isNaN(new Date(r.captured_at).getTime())).toBe(false);
  });

  it("each need line points at a sample need with the same payee and route; the savings line has none", () => {
    for (const l of r.lines) {
      if (l.need_index === null) {
        expect(l.reference_id).toBe("able-savings");
        expect(l.route).toBe("able");
        continue;
      }
      const need = SAMPLE.needs[l.need_index];
      expect(need, `need ${l.need_index}`).toBeDefined();
      expect(l.payee_name).toBe(need.payeeName);
      expect(l.route).toBe(need.route);
      expect(l.payee_account).toBe(need.payeeAccount);
    }
  });

  it("keeps no address, key or token", () => {
    const text = JSON.stringify(r);
    expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    expect(text).not.toMatch(/\b[A-Za-z0-9_-]{40,}\b/);
  });
});
