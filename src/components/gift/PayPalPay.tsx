"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/* Minimal typings for the PayPal JavaScript SDK v6 surface we use. */
type Session = { start: (opts: { presentationMode: "auto" | "popup" | "modal" | "redirect" }, order: Promise<{ orderId: string }>) => Promise<void> };
type SdkInstance = {
  findEligibleMethods: (o: { currencyCode: string }) => Promise<{ isEligible: (m: string) => boolean }>;
  createPayPalOneTimePaymentSession: (o: {
    onApprove: (d: { orderId: string }) => Promise<void> | void;
    onCancel?: (d: { orderId?: string }) => void;
    onError?: (e: Error) => void;
  }) => Session;
};
declare global {
  interface Window {
    paypal?: { createInstance: (o: { clientId: string; components: string[]; pageType?: string }) => Promise<SdkInstance> };
  }
}
declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "paypal-button": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { type?: string; hidden?: boolean };
    }
  }
}

const SDK_SRC = "https://www.sandbox.paypal.com/web-sdk/v6/core";
let instancePromise: Promise<{ sdk: SdkInstance; eligible: boolean }> | null = null;

function loadSdk(clientId: string) {
  instancePromise ??= new Promise<void>((resolve, reject) => {
    if (window.paypal) return resolve();
    const s = document.createElement("script");
    s.src = SDK_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("PayPal could not load. Check your connection."));
    document.head.appendChild(s);
  }).then(async () => {
    const sdk = await window.paypal!.createInstance({ clientId, components: ["paypal-payments"], pageType: "checkout" });
    const methods = await sdk.findEligibleMethods({ currencyCode: "USD" });
    return { sdk, eligible: methods.isEligible("paypal") };
  });
  instancePromise.catch(() => {
    instancePromise = null;
  });
  return instancePromise;
}

export type Capture = { reference_id: string; capture_id: string | null; amount: string | null; payee: string };
export type Receipt = { orderId: string; captureId: string; amount: string; payerFirstName: string | null; captures: Capture[] };

/**
 * PayPal JavaScript SDK v6 button. `createOrder` asks our server for an order (the server decides amounts and payees);
 * on approval the server captures it.
 */
export function PayPalPay({ createOrder, onPaid, disabled }: { createOrder: () => Promise<string>; onPaid?: (r: Receipt) => void; disabled?: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLElement>(null);
  const createRef = useRef(createOrder);
  const paidRef = useRef(onPaid);
  const [state, setState] = useState<"loading" | "ready" | "working" | "unavailable" | "error">("loading");
  const [message, setMessage] = useState("");
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  useEffect(() => {
    createRef.current = createOrder;
    paidRef.current = onPaid;
  });

  useEffect(() => {
    if (!clientId) {
      // Configuration is static for the lifetime of the page.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState("unavailable");
      return;
    }
    let cancelled = false;
    loadSdk(clientId)
      .then(({ sdk, eligible }) => {
        if (cancelled || !ref.current) return;
        if (!eligible) {
          setState("unavailable");
          return;
        }
        const session = sdk.createPayPalOneTimePaymentSession({
          async onApprove({ orderId }) {
            setState("working");
            setMessage("Completing the payment with PayPal…");
            const res = await fetch(`/api/paypal/orders/${orderId}/capture`, { method: "POST" });
            const json = await res.json();
            if (!res.ok) {
              setState("error");
              setMessage(json.error?.message ?? "PayPal could not complete the payment.");
              return;
            }
            setState("ready");
            setMessage("");
            paidRef.current?.({ orderId, captureId: json.data.capture_id, amount: json.data.amount, payerFirstName: json.data.payer_first_name, captures: json.data.captures ?? [] });
            router.refresh();
          },
          onCancel() {
            setState("ready");
            setMessage("Payment cancelled. Nothing was charged.");
          },
          onError(e) {
            setState("error");
            setMessage(e?.message ? `PayPal: ${e.message}` : "PayPal had a problem. Please try again.");
          },
        });
        const btn = ref.current;
        btn.removeAttribute("hidden");
        btn.onclick = () => {
          if (btn.getAttribute("aria-disabled") === "true") return;
          setMessage("");
          // Do not await before start(): the browser needs the click to open PayPal.
          const orderPromise = createRef.current().then((orderId) => ({ orderId }));
          session.start({ presentationMode: "auto" }, orderPromise).catch((err: Error) => {
            setState("error");
            setMessage(err.message);
          });
        };
        setState("ready");
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setState("error");
          setMessage(e.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, router]);

  return (
    <div className="pp-wrap">
      <paypal-button ref={ref} type="pay" hidden className="pp-button" aria-disabled={disabled ? "true" : undefined} data-disabled={disabled ? "" : undefined} />
      {state === "loading" && <p className="pp-note">Loading PayPal…</p>}
      {state === "unavailable" && <p className="pp-note">PayPal checkout is not connected on this server yet.</p>}
      {message && (
        <p className="pp-note" data-tone={state === "error" ? "attention" : undefined} role="status">
          {message}
        </p>
      )}
    </div>
  );
}

/** Ask our server for an order and return its id, or throw a plain-language error. */
export async function requestOrder(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message ?? "Could not start the payment.");
  return j.data.id as string;
}
