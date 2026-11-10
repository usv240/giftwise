import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { today } from "@/lib/api/envelope";
import { dbConfigured } from "@/lib/db";
import { getHousehold, openNeeds } from "@/lib/households";
import { C, OG_SIZE, OgFrame, ogFonts } from "@/lib/og";
import { evaluateGift, monthName, pronounWords, usd, type Profile } from "@/lib/rules";
import { householdProfile } from "@/lib/situation";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "A Giftwise gift page: what the person needs, who is paid, and the SSI check that stays whole";

/** The share image for a gift page: up to four open needs, each with who is paid, and the check that stays whole. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const data = dbConfigured() ? await getHousehold(slug) : null;
  const fonts = await ogFonts();
  const name = data?.household.name ?? "someone";
  const profile: Profile = householdProfile(data?.household.profile);
  const w = pronounWords(profile.pronoun);
  const check = evaluateGift({ id: "og", date: today(), amount: 0, delivery: "vendor", category: "other" }, profile);
  const needs = data ? openNeeds(data.needs).filter((n) => n.amount - n.funded > 0) : [];
  const shown = needs.slice(0, 3);
  return new ImageResponse(
    (
      <OgFrame foot={`Every gift is paid straight to the shop or ${w.poss} ABLE account through PayPal.`}>
        <div style={{ display: "flex", width: "100%", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", fontSize: 64, fontWeight: 500, letterSpacing: -2, lineHeight: 1.1 }}>{`Help ${name}`}</div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 24, gap: 12 }}>
              {shown.map((n) => (
                <div key={n.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 24, background: C.surface, borderRadius: 16, padding: "14px 22px" }}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", fontSize: 28, fontWeight: 500 }}>{n.title}</div>
                    <div style={{ display: "flex", fontSize: 21, color: C.muted, marginTop: 2 }}>{`Paid straight to ${n.payeeName}`}</div>
                  </div>
                  <div style={{ display: "flex", fontSize: 32, fontWeight: 500 }}>{usd(n.amount - n.funded)}</div>
                </div>
              ))}
              {needs.length > shown.length && <div style={{ fontSize: 24, color: C.muted }}>{`and ${needs.length - shown.length} more`}</div>}
              {!shown.length && <div style={{ fontSize: 30, color: C.muted }}>Every need on this page is paid.</div>}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: 360, background: C.surface, borderRadius: 24, padding: "36px 34px" }}>
            <div style={{ fontSize: 26, color: C.muted }}>{`${w.Poss} ${monthName(check.paymentMonth)} check`}</div>
            <div style={{ fontSize: 96, fontWeight: 500, letterSpacing: -3, color: C.positive, lineHeight: 1.05, marginTop: 6 }}>{usd(check.checkBaseline)}</div>
            <div style={{ fontSize: 26, marginTop: 14, lineHeight: 1.3 }}>stays whole, whatever you give.</div>
          </div>
        </div>
      </OgFrame>
    ),
    { ...OG_SIZE, fonts },
  );
}
