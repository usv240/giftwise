import { ImageResponse } from "next/og";
import { C, OG_SIZE, OgFrame, ogFonts } from "@/lib/og";
import { evaluateGift, usd } from "@/lib/rules";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Giftwise: $1,000 given as cash leaves a $74 SSI check; paid to the shop, she keeps $994";

/** The site's share image: the problem in one number, computed by the rules engine (the same gift as the home page's Gift Checker). */
export default async function Image() {
  const fonts = await ogFonts();
  const gift = { id: "og", date: "2026-04-10", amount: 1000, category: "equipment" as const };
  const cash = evaluateGift({ ...gift, delivery: "cash" });
  const shop = evaluateGift({ ...gift, delivery: "vendor" });
  const tile = (label: string, value: string, kept: boolean) => (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, background: C.surface, borderRadius: 24, padding: "30px 34px" }}>
      <div style={{ fontSize: 28, color: C.muted }}>{label}</div>
      <div style={{ fontSize: 112, fontWeight: 500, letterSpacing: -4, lineHeight: 1.05, color: kept ? C.positive : C.ink }}>{value}</div>
    </div>
  );
  return new ImageResponse(
    (
      <OgFrame foot="Benefit-safe giving for people on SSI, paid through PayPal. Every rule cites its source.">
        <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
          <div style={{ fontSize: 68, fontWeight: 500, letterSpacing: -2, lineHeight: 1.05 }}>Give so she keeps her full check.</div>
          <div style={{ fontSize: 30, color: C.muted, marginTop: 16 }}>{`The same ${usd(gift.amount)} gift, and her SSI check two months later:`}</div>
          <div style={{ display: "flex", gap: 24, marginTop: 30 }}>
            {tile("Sent as cash", usd(cash.checkAfter), false)}
            {tile("Paid to the shop", usd(shop.checkAfter), true)}
          </div>
        </div>
      </OgFrame>
    ),
    { ...OG_SIZE, fonts },
  );
}
