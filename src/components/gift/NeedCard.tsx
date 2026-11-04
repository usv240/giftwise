"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Info } from "../Info";
import { PayPalPay, requestOrder, type Receipt } from "./PayPalPay";
import { usd } from "@/lib/rules";
import { giftText, payeeInline, type Lang } from "@/lib/i18n/gift";

export type NeedView = {
  id: number;
  title: string;
  detail: string;
  amount: number;
  funded: number;
  payeeName: string;
  route: string;
  status: string;
  rulePlain: string;
  ruleIds: string[];
  checkAfter: number;
  paidBy: string | null;
  orderId: string | null;
  captureId: string | null;
};

export function NeedCard({ need, name, lang = "en" }: { need: NeedView; name: string; lang?: Lang }) {
  const t = giftText(lang);
  const router = useRouter();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const paid = need.status === "paid" || receipt;
  const orderId = receipt?.orderId ?? need.orderId;
  const who = receipt?.payerFirstName ?? need.paidBy;
  const remaining = Math.max(0, need.amount - need.funded);
  return (
    <article className="need" data-ui data-paid={paid ? "" : undefined} aria-labelledby={`need-${need.id}`}>
      <div className="need-main">
        <h3 id={`need-${need.id}`} className="need-title">
          {need.title}
        </h3>
        <p className="need-detail">{need.detail}</p>
        <p className="need-route">
          <span>
            {t.paidStraightTo} <strong>{payeeInline(lang, need.payeeName)}</strong>
          </span>
          <Info id={need.route === "able" ? "gift.route.able" : "gift.route.vendor"} label="" />
        </p>
        <p className="need-rule">{need.rulePlain}</p>
      </div>
      <div className="need-side">
        <p className="need-amount tabular">{usd(need.amount)}</p>
        {need.funded > 0 && !paid && (
          <p className="need-progress tabular">
            {t.givenToGo(usd(need.funded), usd(remaining))}
          </p>
        )}
        {paid ? (
          <div className="need-receipt" role="status">
            <p className="need-paid">{t.paidBy(who)}</p>
            <p className="need-receipt-line">
              {t.paidLine(payeeInline(lang, need.payeeName), name, usd(need.checkAfter))}
            </p>
            {orderId && (
              <Link className="text-link need-receipt-link" href={`/r/${orderId}${lang === "es" ? "?lang=es" : ""}`}>
                {t.seeReceipt}
              </Link>
            )}
          </div>
        ) : (
          <PayPalPay
            lang={lang}
            createOrder={() => requestOrder("/api/paypal/orders", { needId: need.id })}
            onPaid={(r) => {
              setReceipt(r);
              router.refresh();
            }}
          />
        )}
      </div>
    </article>
  );
}
