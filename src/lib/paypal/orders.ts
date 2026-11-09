import { ApiError, PaypalExperienceUserAction, PaypalWalletContextShippingPreference, type PaymentSource } from "@paypal/paypal-server-sdk";
import { CheckoutPaymentIntent, orders, paypalRest } from "./client";

/** Nothing is shipped to the donor, so PayPal checkout asks for no address and shows who is asking. */
const checkout: PaymentSource = {
  paypal: { experienceContext: { brandName: "Giftwise", shippingPreference: PaypalWalletContextShippingPreference.NoShipping } },
};

export type PayeeOrder = {
  amount: number;
  payeeEmail: string;
  description: string;
  referenceId: string;
  /**
   * Sent as PayPal-Request-Id. Callers pass a fresh id per checkout, because two givers may make the same plan and each
   * needs an order of their own; a retry of this one request gets the same order back. Capture is the idempotent step
   * (src/lib/paypal/capture.ts): one capture per order, however many times it is asked.
   */
  requestId: string;
  softDescriptor?: string;
};

/**
 * Create a PayPal order whose payee is the shop (or the ABLE account), not the platform and not the person.
 * This is "pay another account": the donor's money goes straight to the payee.
 */
export async function createPayeeOrder(o: PayeeOrder) {
  const value = o.amount.toFixed(2);
  const { result } = await orders().createOrder({
    paypalRequestId: o.requestId,
    prefer: "return=representation",
    body: {
      intent: CheckoutPaymentIntent.Capture,
      purchaseUnits: [
        {
          referenceId: o.referenceId,
          description: o.description.slice(0, 127),
          softDescriptor: o.softDescriptor?.slice(0, 22),
          amount: { currencyCode: "USD", value, breakdown: { itemTotal: { currencyCode: "USD", value } } },
          items: [{ name: o.description.slice(0, 127), quantity: "1", unitAmount: { currencyCode: "USD", value } }],
          payee: { emailAddress: o.payeeEmail },
        },
      ],
      paymentSource: checkout,
    },
  });
  return result;
}

export type Unit = { referenceId: string; description: string; amount: number; payeeEmail: string };

/**
 * One PayPal order that pays several recipients directly: each purchase unit has its own payee
 * (the shop, the clinic, her ABLE account). The donor approves once.
 */
/**
 * redirect: set for checkouts that do not use the JavaScript button (for example, an AI agent hands a person the approval link).
 * PayPal then sends the person back to returnUrl, where Giftwise captures the payment.
 */
export async function createRoutedOrder(units: Unit[], requestId: string, redirect?: { returnUrl: string; cancelUrl: string }) {
  const { result } = await orders().createOrder({
    paypalRequestId: requestId,
    prefer: "return=representation",
    body: {
      intent: CheckoutPaymentIntent.Capture,
      purchaseUnits: units.map((u) => {
        const value = u.amount.toFixed(2);
        return {
          referenceId: u.referenceId,
          description: u.description.slice(0, 127),
          softDescriptor: "GIFTWISE",
          amount: { currencyCode: "USD", value, breakdown: { itemTotal: { currencyCode: "USD", value } } },
          items: [{ name: u.description.slice(0, 127), quantity: "1", unitAmount: { currencyCode: "USD", value } }],
          payee: { emailAddress: u.payeeEmail },
        };
      }),
      paymentSource: redirect
        ? { paypal: { experienceContext: { ...checkout.paypal!.experienceContext, returnUrl: redirect.returnUrl, cancelUrl: redirect.cancelUrl, userAction: PaypalExperienceUserAction.PayNow } } }
        : checkout,
    },
  });
  return result;
}

/**
 * An order as PayPal's REST API returns it (GET /v2/checkout/orders/{id}), the fields Giftwise reads. Orders are read
 * over plain REST, not through the Server SDK: the SDK checks each answer against its schema, and PayPal returns a
 * captured multi-payee order with `purchase_units[].shipping.address` as `{}` (no country_code), which the SDK rejects
 * as a ResponseValidationError although PayPal answered 200 COMPLETED. Every order read (Check with PayPal now, the
 * report check, capture, the assistant's fallback and the card check) reads this shape; the SDK still creates orders,
 * where its request types help and PayPal's answer parses cleanly.
 */
export type RestOrder = {
  id?: string;
  status?: string;
  name?: string;
  message?: string;
  details?: { issue?: string; description?: string }[];
  debug_id?: string;
  payer?: { name?: { given_name?: string; surname?: string } };
  purchase_units?: {
    reference_id?: string;
    amount?: { currency_code?: string; value?: string };
    payee?: { email_address?: string; merchant_id?: string };
    payments?: { captures?: { id?: string; status?: string; amount?: { currency_code?: string; value?: string } }[] };
  }[];
  links?: { href?: string; rel?: string; method?: string }[];
};

/** What Check with PayPal now shows: the order's status, and each purchase unit with its payee and its capture. */
export type OrderView = {
  id: string | null;
  status: string | null;
  units: { reference_id: string | null; amount: string | null; payee_email: string | null; captures: { id: string | null; status: string | null; amount: string | null }[] }[];
};

/** The order as Check with PayPal now shows it, from PayPal's REST answer. Pure, so it is tested on a recorded answer. */
export function orderView(o: RestOrder): OrderView {
  return {
    id: o.id ?? null,
    status: o.status ?? null,
    units: (o.purchase_units ?? []).map((pu) => ({
      reference_id: pu.reference_id ?? null,
      amount: pu.amount?.value ?? null,
      payee_email: pu.payee?.email_address ?? null,
      captures: (pu.payments?.captures ?? []).map((c) => ({ id: c.id ?? null, status: c.status ?? null, amount: c.amount?.value ?? null })),
    })),
  };
}

/**
 * Read an order from PayPal over REST. Capture is not in this file: src/lib/paypal/capture.ts captures over plain REST,
 * so it can send PayPal's negative-testing header (PayPal-Mock-Response) for the failure-case runner and retry a 5xx
 * with the same PayPal-Request-Id.
 *
 * A read is safe to repeat, so a 5xx from PayPal's sandbox is read again twice, a moment apart; one that persists is
 * PayPal's side, so it is reported as 502 (a gateway's upstream failed), with PayPal's issue and debug id.
 */
export async function readOrder(orderId: string, o: { retryMs?: number } = {}) {
  const read = () => paypalRest<RestOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
  let res = await read();
  for (let attempt = 1; res.status >= 500 && attempt <= 2; attempt++) {
    await new Promise((r) => setTimeout(r, (o.retryMs ?? 400) * attempt));
    res = await read();
  }
  if (res.status >= 500) {
    const issue = res.body.details?.[0]?.issue ?? res.body.name ?? "PAYPAL_UNAVAILABLE";
    return { ok: false as const, status: 502, issue, plain: GENERIC, debugId: res.debugId ?? res.body.debug_id ?? null };
  }
  if (res.status >= 400) {
    const issue = res.body.details?.[0]?.issue ?? res.body.name ?? "PAYPAL_ERROR";
    return { ok: false as const, status: res.status, issue, plain: PLAIN[issue] ?? (res.status === 404 ? "PayPal has no order with that id." : GENERIC), debugId: res.debugId ?? res.body.debug_id ?? null };
  }
  return { ok: true as const, status: res.status, order: res.body, debugId: res.debugId };
}

const GENERIC = "PayPal could not complete this step. Please try again.";
const PLAIN: Record<string, string> = {
  INSTRUMENT_DECLINED: "That payment method was declined. Please try another one in PayPal.",
  PAYER_ACTION_REQUIRED: "PayPal needs one more step from the payer. Please try again.",
  ORDER_ALREADY_CAPTURED: "This payment is already complete.",
  PAYEE_ACCOUNT_RESTRICTED: "The shop's PayPal account cannot receive payments right now.",
  PAYEE_ACCOUNT_INVALID: "The shop's PayPal account is not set up correctly.",
};

/** A plain message for a PayPal error the Server SDK raised, plus the debug id for Technical mode. */
export function describePayPalError(e: unknown) {
  if (e instanceof ApiError) {
    const body = e.result as { name?: string; message?: string; details?: { issue?: string; description?: string }[]; debug_id?: string } | undefined;
    const issue = body?.details?.[0]?.issue ?? body?.name ?? "PAYPAL_ERROR";
    return { status: e.statusCode, issue, plain: PLAIN[issue] ?? GENERIC, debugId: body?.debug_id ?? null };
  }
  return { status: 500, issue: "UNKNOWN", plain: GENERIC, debugId: null };
}
