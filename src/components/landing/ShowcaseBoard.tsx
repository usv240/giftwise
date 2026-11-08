"use client";

import Link from "next/link";
import { useState } from "react";
import { DEFAULT_PROFILE, checkMonthName, evaluateGift, usd, type Gift } from "@/lib/rules";

type Row = { id: string; name: string; amount: number; giver: string; route: string; status: string; gift: Gift; detail?: string; link?: string };

const mk = (id: string, name: string, amount: number, giver: string, route: string, status: string, gift: Omit<Gift, "id" | "amount" | "date">, detail?: string, link?: string): Row => ({
  id,
  name,
  amount,
  giver,
  route,
  status,
  gift: { id, amount, date: "2026-04-10", ...gift },
  detail,
  link,
});

const ROWS: Row[] = [
  mk("wheelchair", "Wheelchair repair", 420, "Dan", "Paid to shop", "Paid", { delivery: "vendor", category: "equipment" }),
  mk("laptop", "Laptop for college", 649, "Aunt June", "Paid to shop", "Paid", { delivery: "vendor", category: "education" }),
  mk("birthday", "Birthday gift", 300, "Uncle Joe", "Exact item", "Chosen", { delivery: "item", category: "personal" }),
  mk(
    "electric",
    "Electric bill",
    138,
    "Lucy",
    "To ABLE",
    "Reviewed",
    { delivery: "able", category: "utility", recurring: true },
    "Utilities count as housing support. Two reviewers agreed: send it to her ABLE account, and she pays the bill from it.",
    "/try/presets/electric-bill",
  ),
  mk("groceries", "Groceries", 150, "Priya", "Paid to shop", "Paid", { delivery: "vendor", category: "food" }),
  mk("rent", "Rent help", 800, "Dan", "To ABLE", "Paid", { delivery: "able", category: "rent", recurring: true }),
  mk("phone", "Phone bill", 65, "Rosa", "Paid to shop", "Paid", { delivery: "vendor", category: "phone" }),
  mk("therapy", "Therapy co-pay", 90, "Rosa", "Paid to shop", "Waiting", { delivery: "vendor", category: "medical" }),
];

export function ShowcaseBoard() {
  const [open, setOpen] = useState("electric");
  return (
    <div className="board" data-ui role="list" aria-label="Sample requests and how each was routed">
      {ROWS.map((r) => {
        const isOpen = open === r.id;
        const res = evaluateGift(r.gift, DEFAULT_PROFILE);
        return (
          <div key={r.id} role="listitem" className="board-row" data-open={isOpen ? "" : undefined}>
            <button type="button" className="board-btn" aria-expanded={isOpen} onClick={() => setOpen(r.id)}>
              <span className="board-name">{r.name}</span>
              <span className="board-fact tabular">{usd(r.amount)}</span>
              <span className="board-fact board-giver">{r.giver}</span>
              <span className="board-fact board-route">{r.route}</span>
              <span className="board-status" data-status={r.status}>
                {r.status}
              </span>
            </button>
            {isOpen && (
              <div className="board-detail">
                <p>{r.detail ?? res.explanation.plain}</p>
                <p className="board-detail-meta tabular">
                  Her {checkMonthName(res.paymentMonth)} check: {usd(res.checkAfter)}.<span className="board-tech"> Rules {res.ruleIds.filter((x) => x !== "R-RES-01").join(", ")}.</span>
                  {r.link && (
                    <>
                      {" "}
                      <Link href={r.link} className="board-link">
                        See the two reviewers
                      </Link>
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
