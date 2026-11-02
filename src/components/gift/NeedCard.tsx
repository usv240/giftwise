"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Info } from "../Info";
import { PayPalPay, requestOrder, type Receipt } from "./PayPalPay";
import { usd } from "@/lib/rules";

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

export function NeedCard({ need, name }: { need: NeedView; name: string }) {
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
            Paid straight to <strong>{need.payeeName}</strong>
          </span>
          <Info id={need.route === "able" ? "gift.route.able" : "gift.route.vendor"} label="" />
        </p>
        <p className="need-rule">{need.rulePlain}</p>
      </div>
      <div className="need-side">
        <p className="need-amount tabular">{usd(need.amount)}</p>
        {need.funded > 0 && !paid && (
          <p className="need-progress tabular">
            {usd(need.funded)} given, {usd(remaining)} to go
          </p>
        )}
        {paid ? (
          <div className="need-receipt" role="status">
            <p className="need-paid">Paid{who ? ` by ${who}` : ""}</p>
            <p className="need-receipt-line">
              Paid to {need.payeeName}. {name} keeps {usd(need.checkAfter)} this month.
            </p>
            {orderId && (
              <Link className="text-link need-receipt-link" href={`/r/${orderId}`}>
                See the receipt
              </Link>
            )}
          </div>
        ) : (
          <PayPalPay
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
