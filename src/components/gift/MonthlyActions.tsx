"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PayPalPay, requestOrder } from "./PayPalPay";

/** Approve one month of a monthly gift in PayPal. The server routes the month again before it creates the order. */
export function PayMonth({ token, month }: { token: string; month: string }) {
  const router = useRouter();
  return <PayPalPay createOrder={() => requestOrder(`/api/monthly/${token}/order`, { month })} onPaid={() => router.refresh()} />;
}

/** Sandbox only: plan the next month now, so the rules can be seen routing the same gift again. */
export function PlanNext({ token, label }: { token: string; label: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [note, setNote] = useState("");
  const go = async () => {
    setState("working");
    setNote("");
    try {
      const r = await fetch(`/api/monthly/${token}/next`, { method: "POST" });
      const j = (await r.json()) as { error?: { message?: string } };
      if (!r.ok) {
        setState("error");
        setNote(j.error?.message ?? "Could not plan the next month.");
        return;
      }
      setState("idle");
      router.refresh();
    } catch {
      setState("error");
      setNote("Could not reach the server. Try again.");
    }
  };
  return (
    <span className="mo-next">
      <button type="button" className="btn btn-quiet" onClick={go} disabled={state === "working"}>
        {state === "working" ? "Planning…" : label}
      </button>
      <span className="mo-note" role="status" aria-live="polite" data-tone={state === "error" ? "attention" : undefined}>
        {note}
      </span>
    </span>
  );
}

/** After a gift, offer to give the same amount every month. */
export function StartMonthly({ slug, amount, orderId, giverName }: { slug: string; amount: number; orderId: string; giverName: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [note, setNote] = useState("");
  const go = async () => {
    setState("working");
    try {
      const r = await fetch("/api/monthly", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, amount, order_id: orderId, giver_name: giverName ?? undefined }) });
      const j = (await r.json()) as { data?: { url: string }; error?: { message?: string } };
      if (!j.data) {
        setState("error");
        setNote(j.error?.message ?? "Could not start the monthly gift.");
        return;
      }
      router.push(j.data.url);
    } catch {
      setState("error");
      setNote("Could not reach the server. Try again.");
    }
  };
  return (
    <span className="mo-start">
      <button type="button" className="give-again" onClick={go} disabled={state === "working"}>
        {state === "working" ? "Setting it up…" : "Give this every month"}
      </button>
      {note && (
        <span className="mo-note" role="status" data-tone="attention">
          {note}
        </span>
      )}
    </span>
  );
}
