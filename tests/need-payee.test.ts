import { afterEach, describe, expect, it } from "vitest";
import { SAMPLE, isPayPalEmail, maskEmail, ownPayee, payeeEmail, publicPayee } from "@/lib/households";
import { checkPayee, editedPayee, routeNeed } from "@/lib/manage";
import { routeGift } from "@/lib/routing";

/**
 * A payee per need: an organizer gives a need the shop's own PayPal email, it is stored on the need ("paypal:<email>"),
 * the order pays it (sandbox only), and pages show it masked. The sample page's payees stay the site's test accounts.
 */
describe("an organizer's own PayPal payee for a need", () => {
  const env = process.env.PAYPAL_ENV;
  afterEach(() => {
    if (env === undefined) delete process.env.PAYPAL_ENV;
    else process.env.PAYPAL_ENV = env;
  });

  it("is checked for format before it is stored", () => {
    expect(checkPayee("shop@example.com")).toBeNull();
    expect(checkPayee(" Riverside.Repair+gifts@Example.co.uk ")).toBeNull();
    expect(checkPayee(null)).toBeNull();
    expect(checkPayee("")).toBeNull();
    for (const bad of ["shop", "shop@", "@example.com", "shop@example", "shop @example.com", "a<b>@example.com", `${"x".repeat(250)}@example.com`]) expect(checkPayee(bad), bad).toMatch(/does not look right/);
    expect(isPayPalEmail("sb-abc123@business.example.com")).toBe(true);
  });

  it("is stored on a shop need and never on housing, which always pays the ABLE account", () => {
    const shop = routeNeed("Lee", "they", { title: "Ramp", amount: 300, category: "equipment", vendor: "Hill Ramps", payeePaypal: "hill@example.com" });
    expect(shop).toMatchObject({ route: "vendor", payeeName: "Hill Ramps", payeeAccount: "paypal:hill@example.com" });
    expect(routeNeed("Lee", "they", { title: "Ramp", amount: 300, category: "equipment", vendor: "Hill Ramps" }).payeeAccount).toBe("vendor");
    const rent = routeNeed("Lee", "they", { title: "Rent", amount: 600, category: "rent", payeePaypal: "landlord@example.com" });
    expect(rent).toMatchObject({ route: "able", payeeAccount: "able" });
  });

  it("an edit sets, keeps or clears it; a sample shop keeps its own sandbox account", () => {
    const own = { route: "vendor", payeeAccount: "paypal:hill@example.com" };
    const routed = { route: "vendor", payeeAccount: "vendor" };
    expect(editedPayee(own, routed, undefined)).toBe("paypal:hill@example.com");
    expect(editedPayee(own, routed, "new@example.com")).toBe("paypal:new@example.com");
    expect(editedPayee(own, routed, null)).toBe("vendor");
    expect(editedPayee({ route: "vendor", payeeAccount: "vendor" }, routed, "hill@example.com")).toBe("paypal:hill@example.com");
    expect(editedPayee(own, { route: "able", payeeAccount: "able" }, "hill@example.com")).toBe("able");
    for (const n of SAMPLE.needs.filter((x) => x.route === "vendor")) expect(editedPayee(n, routed, "someone@example.com"), n.title).toBe(n.payeeAccount);
  });

  it("the order pays it in the sandbox, and it is refused outside the sandbox", () => {
    delete process.env.PAYPAL_ENV;
    expect(payeeEmail("paypal:hill@example.com")).toBe("hill@example.com");
    process.env.PAYPAL_ENV = "live";
    expect(() => payeeEmail("paypal:hill@example.com")).toThrow(/sandbox only/);
  });

  it("a routed gift carries it to the order line, and what leaves the server shows it only masked", () => {
    const plan = routeGift(200, [{ id: 9, title: "Ramp", category: "equipment", route: "vendor", payeeName: "Hill Ramps", payeeAccount: "paypal:hill@example.com", amount: 300, funded: 0, recurring: false }], "2026-11-10");
    expect(plan.lines[0]).toMatchObject({ payeeName: "Hill Ramps", payeeAccount: "paypal:hill@example.com", amount: 200 });
    expect(ownPayee(plan.lines[0].payeeAccount)).toBe("hill@example.com");
    expect(publicPayee(plan.lines[0].payeeAccount)).toBe("paypal");
    expect(publicPayee("vendor:riverside")).toBe("vendor:riverside");
    expect(maskEmail("hillramps@example.com")).toBe("hillra…@example.com");
  });
});
