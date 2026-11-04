import { describe, expect, it } from "vitest";
import { asLang, giftText, payeeIn, payeeInline, receiptText, sampleIn } from "@/lib/i18n/gift";
import { ruleSentenceEs } from "@/lib/i18n/gift-rules";
import { DEFAULT_PROFILE, evaluateGift } from "@/lib/rules";

const gift = (over: Parameters<typeof evaluateGift>[0]) => evaluateGift(over, DEFAULT_PROFILE);

describe("the giver's side in Spanish", () => {
  it("names the month the check is paid, in Spanish, with the 2027 rate for November's gifts", () => {
    const shop = gift({ id: "a", date: "2026-11-10", amount: 420, delivery: "vendor", category: "equipment" });
    expect(ruleSentenceEs(shop)).toBe("Se paga directamente a la tienda, así que no se cuenta. Su cheque de enero se mantiene en $1,029.");
    const school = gift({ id: "b", date: "2026-04-10", amount: 649, delivery: "vendor", category: "education" });
    expect(ruleSentenceEs(school)).toMatch(/^Un regalo para matrícula, libros o útiles escolares no se cuenta\. Su cheque de junio se mantiene en \$994\. Guarde los recibos\.$/);
  });

  it("follows the engine's branch for ABLE, housing help and an ABLE account someone cannot have", () => {
    expect(ruleSentenceEs(gift({ id: "c", date: "2026-04-10", amount: 138, delivery: "able", category: "utility" }))).toMatch(/^Un regalo a su cuenta ABLE no se cuenta/);
    expect(ruleSentenceEs(gift({ id: "d", date: "2026-04-10", amount: 800, delivery: "vendor", category: "rent", recurring: true }))).toMatch(/cuenta como apoyo para vivienda, hasta \$351\.33 al mes/);
    const noAble = evaluateGift({ id: "e", date: "2026-04-10", amount: 100, delivery: "able", category: "other" }, { ...DEFAULT_PROFILE, ableEligible: false });
    expect(ruleSentenceEs(noAble)).toMatch(/^Una cuenta ABLE es para personas cuya discapacidad empezó antes de los 46 años/);
  });

  it("has the same text keys in both languages", () => {
    expect(Object.keys(giftText("es")).sort()).toEqual(Object.keys(giftText("en")).sort());
    expect(Object.keys(receiptText("es")).sort()).toEqual(Object.keys(receiptText("en")).sort());
  });

  it("writes the ABLE account the Spanish way, and keeps a family's own words as written", () => {
    expect(payeeIn("es", "Maya's ABLE account")).toBe("Cuenta ABLE de Maya");
    expect(payeeInline("es", "Maya's ABLE account")).toBe("la cuenta ABLE de Maya");
    expect(payeeIn("es", "Riverside Mobility Repair")).toBe("Riverside Mobility Repair");
    expect(sampleIn("es", "Wheelchair repair")).toBe("Reparación de la silla de ruedas");
    expect(sampleIn("es", "Wheelchair repair", false)).toBe("Wheelchair repair");
    expect(asLang("fr")).toBe("en");
  });
});
