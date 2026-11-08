"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { giftText, type Lang } from "@/lib/i18n/gift";
import { paypalEnv, paypalHosts } from "@/lib/paypal/env";
import "./paypal.css";

/* Minimal typings for the PayPal JavaScript SDK v6 surface we use. */
type Session = { start: (opts: { presentationMode: "auto" | "popup" | "modal" | "redirect"; targetElement?: EventTarget }, order: Promise<{ orderId: string }>) => Promise<void> };
type SessionOptions = {
  onApprove: (d: { orderId: string }) => Promise<void> | void;
  onCancel?: (d: { orderId?: string }) => void;
  onError?: (e: Error) => void;
};
type SdkInstance = {
  findEligibleMethods: (o: { currencyCode: string }) => Promise<{ isEligible: (m: string) => boolean }>;
  createPayPalOneTimePaymentSession: (o: SessionOptions) => Session;
  /** PayPal's guest card form (the "paypal-guest-payments" component): a debit or credit card, no PayPal account. */
  createPayPalGuestOneTimePaymentSession?: (o: SessionOptions) => Session;
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
      "paypal-basic-card-container": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      "paypal-basic-card-button": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { hidden?: boolean };
    }
  }
}

/** The same PayPal the server calls: next.config.ts copies PAYPAL_ENV into NEXT_PUBLIC_PAYPAL_ENV at build. */
const SDK_SRC = paypalHosts(paypalEnv(process.env.NEXT_PUBLIC_PAYPAL_ENV)).sdk;

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
/**
 * One SDK instance per language: PayPal draws its buttons and checkout in the page's language. It carries PayPal
 * checkout and PayPal's guest card form; findEligibleMethods says which of the two this app and buyer may use.
 */
const instances = new Map<Lang, Promise<{ sdk: SdkInstance; eligible: boolean; card: boolean }>>();
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
      const sdk = await window.paypal!.createInstance({ clientId, components: ["paypal-payments", "paypal-guest-payments"], pageType: "checkout", locale: lang === "es" ? "es-US" : "en-US" });
      const methods = await sdk.findEligibleMethods({ currencyCode: "USD" });
      return { sdk, eligible: methods.isEligible("paypal"), card: methods.isEligible("card") && typeof sdk.createPayPalGuestOneTimePaymentSession === "function" };
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
 * for a need in a list. `card` adds PayPal's own "Debit or Credit Card" button under it, where PayPal says this buyer
 * may use it: PayPal's guest card form pays the same order with a card and no PayPal account, and the server captures
 * it the same way.
 */
export function PayPalPay({
  createOrder,
  onPaid,
  disabled,
  lang = "en",
  describedBy,
  look = "gold",
  card = false,
}: {
  createOrder: () => Promise<string>;
  onPaid?: (r: Receipt) => void;
  disabled?: boolean;
  lang?: Lang;
  describedBy?: string;
  look?: "gold" | "white";
  card?: boolean;
}) {
  const t = giftText(lang);
  const router = useRouter();
  const ref = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLElement>(null);
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

  // PayPal's real buttons live in their shadow DOM, so each is told directly when it cannot be used and what it pays for.
  useEffect(() => {
    const sync = () => {
      const said = (describedBy ?? "")
        .split(" ")
        .map((id) => (id ? (document.getElementById(id)?.textContent?.replace(/\s+/g, " ").trim() ?? "") : ""))
        .filter(Boolean)
        .join(" ");
      // Done once every button PayPal has shown has drawn its own inner button.
      let done = true;
      for (const host of [ref.current, cardRef.current]) {
        if (!host || host.hidden) continue;
        const inner = host.shadowRoot?.querySelector("button");
        if (!inner) {
          done = false;
          continue;
        }
        if (disabled) inner.setAttribute("aria-disabled", "true");
        else inner.removeAttribute("aria-disabled");
        if (said) inner.setAttribute("aria-description", said);
        else inner.removeAttribute("aria-description");
      }
      return done && Boolean(ref.current?.shadowRoot?.querySelector("button"));
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
      .then(({ sdk, eligible, card: cardEligible }) => {
        if (cancelled || !ref.current) return;
        if (!eligible) {
          setState("unavailable");
          return;
        }
        const stopped = () => {
          setState("error");
          setMessage(plainRef.current ?? t.ppStopped);
        };
        // PayPal checkout and the guest card form end the same way: Giftwise's server captures the approved order.
        const handlers: SessionOptions = {
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
        };
        /** Each press asks the server for a fresh order and opens PayPal's own window for it. */
        const wire = (btn: HTMLElement, session: Session, guest = false) => {
          btn.removeAttribute("hidden");
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
            // The card form opens over the page next to its own button (targetElement); PayPal checkout opens as before.
            session.start(guest ? { presentationMode: "auto", targetElement: btn } : { presentationMode: "auto" }, orderPromise).catch(stopped);
          };
        };
        wire(ref.current, sdk.createPayPalOneTimePaymentSession(handlers));
        if (card && cardEligible && cardRef.current && sdk.createPayPalGuestOneTimePaymentSession) wire(cardRef.current, sdk.createPayPalGuestOneTimePaymentSession(handlers), true);
        drawnRef.current = true;
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
  }, [clientId, router, lang, t, attempt, card]);

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
      {/* PayPal's guest card form: a debit or credit card, no PayPal account. Hidden until PayPal says it may be used. */}
      {card && (
        <paypal-basic-card-container className="pp-card-wrap">
          <paypal-basic-card-button
            ref={cardRef}
            hidden
            className="pp-button pp-card"
            aria-describedby={describedBy}
            aria-disabled={disabled ? "true" : undefined}
            data-disabled={disabled ? "" : undefined}
          />
        </paypal-basic-card-container>
      )}
      {/* Holds the button's place until PayPal draws it, so nothing below moves. A failed load keeps the same place. */}
      {(state === "waiting" || state === "loading") && (
        <p className="pp-slot" data-loading={state === "loading" ? "" : undefined}>
          {t.ppLoading}
        </p>
      )}
      {/* The card button's place too, so nothing below moves when PayPal draws it. */}
      {card && (state === "waiting" || state === "loading") && <span className="pp-slot" aria-hidden="true" />}
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
