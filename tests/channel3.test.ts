import { describe, expect, it } from "vitest";
import { categoryFor, checkProducts, isGiftCard, sampleProducts, type FoundProduct } from "@/lib/channel3";
import { DEFAULT_PROFILE } from "@/lib/rules";

const product = (over: Partial<FoundProduct>): FoundProduct => ({ id: "p", title: "Thing", brand: null, image: null, imageAlt: null, url: "https://shop.example/p", domain: "shop.example", price: 50, currency: "USD", inStock: true, categoryPath: null, ...over });

describe("the gift finder's rules check", () => {
  it("maps retailer categories to the SSI rule categories", () => {
    expect(categoryFor("Pressure-relief wheelchair cushion", "Health > Mobility")).toBe("equipment");
    expect(categoryFor("Intro to Psychology textbook", "Books > Textbooks")).toBe("education");
    expect(categoryFor("Waterproof winter coat", "Clothing > Coats")).toBe("clothing");
    expect(categoryFor("Blood pressure monitor", "Health > Medical devices")).toBe("medical");
    expect(categoryFor("Concert ticket", null)).toBe("event");
  });

  it("lets an item paid straight to the retailer through, with her check whole", () => {
    const [c] = checkProducts([product({ title: "Wheelchair cushion", price: 89 })], DEFAULT_PROFILE, "2026-11-10");
    expect(c.addable).toBe(true);
    expect(c.check).toBe(c.checkBaseline);
    expect(c.rule).toMatch(/not counted/);
  });

  it("holds back a gift card, which SSA counts like cash, and names why", () => {
    expect(isGiftCard("Grocery store gift card, $100")).toBe(true);
    const [c] = checkProducts([product({ title: "Grocery store gift card, $100", price: 100 })], DEFAULT_PROFILE, "2026-11-10");
    expect(c.giftCard).toBe(true);
    expect(c.addable).toBe(false);
    expect(c.rule).toMatch(/counts a gift card .* like cash/);
  });

  it("holds back what is out of stock or not priced in dollars", () => {
    const [a, b] = checkProducts([product({ inStock: false }), product({ currency: "EUR" })], DEFAULT_PROFILE, "2026-11-10");
    expect(a.addable).toBe(false);
    expect(b.addable).toBe(false);
  });

  it("finds sample products by any word, within a price limit", () => {
    expect(sampleProducts("wheelchair cushion").some((p) => /cushion/i.test(p.title))).toBe(true);
    expect(sampleProducts("laptop", 100).every((p) => p.price <= 100)).toBe(true);
  });
});
