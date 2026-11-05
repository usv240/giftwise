"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { giftText, type Lang } from "@/lib/i18n/gift";
import "./paypal.css";

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
    paypal?: { createInstance: (o: { clientId: string; components: string[]; pageType?: string; locale?: string }) => Promise<SdkInstance> };
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

/**
 * PayPal's SDK is about 300 ms of script on a mid-range phone, and no one pays before touching the page. So it loads at
 * the first sign of a person (a touch, a key, a scroll, the pointer moving, focus) or, failing that, once the browser has
 * been idle a few seconds after the page loaded, so someone using a screen reader finds a ready button without pressing
 * anything first. The page itself is interactive sooner on a phone.
 */
let wanted: Promise<void> | null = null;
const INTENT = ["pointerdown", "pointermove", "touchstart", "keydown", "wheel", "scroll", "focusin"] as const;
function whenWanted() {
  wanted ??= new Promise<void>((resolve) => {
    let timer: number | undefined;
    const go = () => {
      for (const e of INTENT) window.removeEventListener(e, go, true);
      window.clearTimeout(timer);
      resolve();
    };
    for (const e of INTENT) window.addEventListener(e, go, { capture: true, passive: true });
    const afterLoad = () => {
      timer = window.setTimeout(() => ("requestIdleCallback" in window ? window.requestIdleCallback(go, { timeout: 2000 }) : go()), 3000);
    };
    if (document.readyState === "complete") afterLoad();
    else window.addEventListener("load", afterLoad, { once: true });
  });
  return wanted;
}
/** One SDK instance per language: PayPal draws its button and checkout in the page's language. */
const instances = new Map<Lang, Promise<{ sdk: SdkInstance; eligible: boolean }>>();
let scriptPromise: Promise<void> | null = null;

function loadSdk(clientId: string, lang: Lang) {
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    if (window.paypal) return resolve();
    const s = document.createElement("script");
    s.src = SDK_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("PayPal could not load. Check your connection."));
    document.head.appendChild(s);
  });
  scriptPromise.catch(() => {
    scriptPromise = null;
  });
  let p = instances.get(lang);
  if (!p) {
    p = scriptPromise.then(async () => {
      const sdk = await window.paypal!.createInstance({ clientId, components: ["paypal-payments"], pageType: "checkout", locale: lang === "es" ? "es-US" : "en-US" });
      const methods = await sdk.findEligibleMethods({ currencyCode: "USD" });
      return { sdk, eligible: methods.isEligible("paypal") };
    });
    p.catch(() => instances.delete(lang));
    instances.set(lang, p);
  }
  return p;
}

export type Capture = { reference_id: string; capture_id: string | null; amount: string | null; payee: string };
export type Receipt = { orderId: string; captureId: string; amount: string; payerFirstName: string | null; captures: Capture[] };

/** An error in Giftwise's own plain words (from our server), safe to show the giver as it is. */
export class PlainError extends Error {}

/** Every button on the page whose PayPal never loaded. One "Try again" reloads PayPal for all of them. */
const unloaded = new Set<() => void>();

/**
 * PayPal JavaScript SDK v6 button. `createOrder` asks our server for an order (the server decides amounts and payees);
 * on approval the server captures it. `describedBy` names the line just above the button that says what this payment
 * is; the button's own description reads it too. `look` is PayPal's own color: gold for the main way to give, white
 * for a need in a list.
 */
export function PayPalPay({
  createOrder,
  onPaid,
  disabled,
  lang = "en",
  describedBy,
  look = "gold",
}: {
  createOrder: () => Promise<string>;
  onPaid?: (r: Receipt) => void;
  disabled?: boolean;
  lang?: Lang;
  describedBy?: string;
  look?: "gold" | "white";
}) {
  const t = giftText(lang);
  const router = useRouter();
  const ref = useRef<HTMLElement>(null);
  const createRef = useRef(createOrder);
  const paidRef = useRef(onPaid);
  /** Our server's own words for the last failed order, so a PayPal error that follows it does not replace them. */
  const plainRef = useRef<string | null>(null);
  /** Once PayPal has drawn its button it stays on screen; a retry then only makes a new checkout session. */
  const drawnRef = useRef(false);
  // "failed": PayPal never loaded, so there is no button. "error": the button is there, and the last try stopped.
  const [state, setState] = useState<"waiting" | "loading" | "ready" | "working" | "unavailable" | "failed" | "error">("waiting");
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  useEffect(() => {
    createRef.current = createOrder;
    paidRef.current = onPaid;
  });

  // PayPal's real button lives in its shadow DOM, so it is told directly when it cannot be used and what it pays for.
  useEffect(() => {
    const sync = () => {
      const inner = ref.current?.shadowRoot?.querySelector("button");
      if (!inner) return false;
      if (disabled) inner.setAttribute("aria-disabled", "true");
      else inner.removeAttribute("aria-disabled");
      const said = (describedBy ?? "")
        .split(" ")
        .map((id) => (id ? (document.getElementById(id)?.textContent?.replace(/\s+/g, " ").trim() ?? "") : ""))
        .filter(Boolean)
        .join(" ");
      if (said) inner.setAttribute("aria-description", said);
      else inner.removeAttribute("aria-description");
      return true;
    };
    if (sync() || (state !== "ready" && state !== "error")) return;
    const frame = window.requestAnimationFrame(sync);
    return () => window.cancelAnimationFrame(frame);
  });

  useEffect(() => {
    if (!clientId) {
      // Configuration is static for the lifetime of the page.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState("unavailable");
      return;
    }
    let cancelled = false;
    whenWanted()
      .then(() => {
        if (!cancelled && !drawnRef.current) setState("loading");
        return loadSdk(clientId, lang);
      })
      .then(({ sdk, eligible }) => {
        if (cancelled || !ref.current) return;
        if (!eligible) {
          setState("unavailable");
          return;
        }
        const stopped = () => {
          setState("error");
          setMessage(plainRef.current ?? t.ppStopped);
        };
        const session = sdk.createPayPalOneTimePaymentSession({
          async onApprove({ orderId }) {
            setState("working");
            setMessage(t.ppCompleting);
            try {
              const res = await fetch(`/api/paypal/orders/${orderId}/capture`, { method: "POST" });
              const json = await res.json().catch(() => ({}));
              if (!res.ok) {
                setState("error");
                setMessage(json.error?.message ?? t.ppFailed);
                return;
              }
              setState("ready");
              setMessage("");
              paidRef.current?.({ orderId, captureId: json.data.capture_id, amount: json.data.amount, payerFirstName: json.data.payer_first_name, captures: json.data.captures ?? [] });
              router.refresh();
            } catch {
              setState("error");
              setMessage(t.ppFailed);
            }
          },
          onCancel() {
            setState("ready");
            setMessage(t.ppCancelled);
          },
          onError: stopped,
        });
        const btn = ref.current;
        btn.removeAttribute("hidden");
        drawnRef.current = true;
        btn.onclick = () => {
          if (btn.getAttribute("aria-disabled") === "true") return;
          setMessage("");
          plainRef.current = null;
          // Do not await before start(): the browser needs the click to open PayPal.
          const orderPromise = createRef.current().then((orderId) => ({ orderId }));
          orderPromise.catch((err: unknown) => {
            plainRef.current = err instanceof PlainError ? err.message : null;
            stopped();
          });
          session.start({ presentationMode: "auto" }, orderPromise).catch(stopped);
        };
        setState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        // PayPal's own error text is not written for the giver, so the page says it in plain words.
        setState(drawnRef.current ? "error" : "failed");
        setMessage(drawnRef.current ? t.ppStopped : t.ppLoadFailed);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, router, lang, t, attempt]);

  /** Start over: load PayPal again if it never loaded, or make a fresh checkout session for the button on screen. */
  const retry = () => {
    plainRef.current = null;
    setMessage("");
    setState(drawnRef.current ? "ready" : "loading");
    setAttempt((n) => n + 1);
  };

  // While this button's PayPal has not loaded, a "Try again" pressed on any button on the page reloads this one too.
  const retryRef = useRef(retry);
  useEffect(() => {
    retryRef.current = retry;
  });
  useEffect(() => {
    if (state !== "failed") return;
    const again = () => retryRef.current();
    unloaded.add(again);
    return () => {
      unloaded.delete(again);
    };
  }, [state]);

  return (
    <div className="pp-wrap">
      <paypal-button
        ref={ref}
        type="pay"
        hidden
        className={look === "white" ? "pp-button paypal-white" : "pp-button"}
        aria-describedby={describedBy}
        aria-disabled={disabled ? "true" : undefined}
        data-disabled={disabled ? "" : undefined}
      />
      {/* Holds the button's place until PayPal draws it, so nothing below moves. A failed load keeps the same place. */}
      {(state === "waiting" || state === "loading") && (
        <p className="pp-slot" data-loading={state === "loading" ? "" : undefined}>
          {t.ppLoading}
        </p>
      )}
      {state === "failed" && (
        <div className="pp-slot pp-failed" role="status">
          <span>{message}</span>
          <button type="button" className="pp-retry" onClick={() => [...unloaded].forEach((again) => again())}>
            {t.ppRetry}
          </button>
        </div>
      )}
      {state === "unavailable" && <p className="pp-note">{t.ppUnavailable}</p>}
      {message && state !== "failed" && (
        <p className="pp-note" data-tone={state === "error" ? "attention" : undefined} role="status">
          {message}
          {state === "error" && (
            <>
              {" "}
              <button type="button" className="pp-retry" onClick={retry}>
                {t.ppRetry}
              </button>
            </>
          )}
        </p>
      )}
    </div>
  );
}

/** Ask our server for an order and return its id, or throw its plain-language reason. */
export async function requestOrder(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new PlainError(j.error?.message ?? "Could not start the payment.");
  return j.data.id as string;
}
