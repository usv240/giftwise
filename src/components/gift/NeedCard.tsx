"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Info } from "../Info";
import { PayPalPay, requestOrder, type Receipt } from "./PayPalPay";
import { pronounWords, usd, type Profile } from "@/lib/rules";
import { checkMonthIn, giftText, payeeInline, type Lang } from "@/lib/i18n/gift";

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
  /** The check this need's gift decides, "YYYY-MM", and whether that check stays the same. */
  checkMonth: string;
  checkStays: boolean;
  paidBy: string | null;
  orderId: string | null;
  captureId: string | null;
  link?: string | null;
};

/**
 * One need in the list: what it is and the rule, then, right above its own PayPal button, the exact amount and who is
 * paid. Its button is PayPal's white one: the gold "Give any amount" button stays the main way to give.
 */
export function NeedCard({ need, pronoun = "she", lang = "en", closed = false }: { need: NeedView; pronoun?: Profile["pronoun"]; lang?: Lang; closed?: boolean }) {
  const t = giftText(lang);
  const w = pronounWords(pronoun);
  const router = useRouter();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const paid = need.status === "paid" || receipt;
  const orderId = receipt?.orderId ?? need.orderId;
  const who = receipt?.payerFirstName ?? need.paidBy;
  const remaining = Math.max(0, need.amount - need.funded);
  const payee = payeeInline(lang, need.payeeName);
  const payId = `need-${need.id}-pay`;
  return (
    <article className="need" data-ui data-paid={paid ? "" : undefined} aria-labelledby={`need-${need.id}`}>
      <div className="need-main">
        <h3 id={`need-${need.id}`} className="need-title">
          {need.title}
        </h3>
        <p className="need-detail">{need.detail}</p>
        {need.link && (
          <p className="need-link">
            <a className="text-link" href={need.link} target="_blank" rel="noreferrer nofollow">
              {t.seeItem(new URL(need.link).hostname.replace(/^www\./, ""))}
            </a>
          </p>
        )}
        <p className="need-rule">{need.rulePlain}</p>
      </div>
      <div className="need-side">
        <p id={`need-${need.id}-amount`} className="need-amount tabular">
          {usd(need.amount)}
        </p>
        {need.funded > 0 && !paid && (
          <p className="need-progress tabular">
            {t.givenToGo(usd(need.funded), usd(remaining))}
          </p>
        )}
        {paid ? (
          <div className="need-receipt" role="status">
            <p className="need-paid">{t.paidBy(who)}</p>
            <p className="need-receipt-line">
              {t.paidLine(payee, w, checkMonthIn(lang, need.checkMonth), usd(need.checkAfter), need.checkStays)}
            </p>
            {orderId && (
              <>
                <p className="need-receipt-id tabular">{t.orderLine(orderId)}</p>
                <Link className="text-link need-receipt-link" href={`/r/${orderId}${lang === "es" ? "?lang=es" : ""}`}>
                  {t.seeReceipt}
                </Link>
              </>
            )}
          </div>
        ) : closed ? null : (
          <>
            <p className="need-pay">
              {/* The amount above is what this button pays, unless part is given already: then the line says the rest. */}
              <span id={payId}>{need.funded > 0 ? t.needPay(usd(remaining), payee) : t.needGoes(payee)}</span>
              <Info id={need.route === "able" ? "gift.route.able" : "gift.route.vendor"} label="" topic={`${t.paidStraightTo} ${payee}`} lang={lang} />
            </p>
            <PayPalPay
              lang={lang}
              look="white"
              describedBy={need.funded > 0 ? payId : `need-${need.id}-amount ${payId}`}
              createOrder={() => requestOrder("/api/paypal/orders", { needId: need.id })}
              onPaid={(r) => {
                setReceipt(r);
                router.refresh();
              }}
            />
          </>
        )}
      </div>
    </article>
  );
}
