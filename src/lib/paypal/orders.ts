import { ApiError, PaypalWalletContextShippingPreference, type PaymentSource } from "@paypal/paypal-server-sdk";
import { CheckoutPaymentIntent, orders } from "./client";

/** Nothing is shipped to the donor, so PayPal checkout asks for no address and shows who is asking. */
const checkout: PaymentSource = {
  paypal: { experienceContext: { brandName: "Giftwise", shippingPreference: PaypalWalletContextShippingPreference.NoShipping } },
};

export type PayeeOrder = {
  amount: number;
  payeeEmail: string;
  description: string;
  referenceId: string;
  /** Idempotency: the same plan never creates two orders. */
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
export async function createRoutedOrder(units: Unit[], requestId: string) {
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
      paymentSource: checkout,
    },
  });
  return result;
}

export async function captureOrder(orderId: string, requestId: string) {
  const { result } = await orders().captureOrder({ id: orderId, paypalRequestId: requestId, prefer: "return=representation" });
  return result;
}

export async function getOrder(orderId: string) {
  const { result } = await orders().getOrder({ id: orderId });
  return result;
}

/** A plain message for a PayPal error, plus the debug id for Technical mode. */
export function describePayPalError(e: unknown) {
  if (e instanceof ApiError) {
    const body = e.result as { name?: string; message?: string; details?: { issue?: string; description?: string }[]; debug_id?: string } | undefined;
    const issue = body?.details?.[0]?.issue ?? body?.name ?? "PAYPAL_ERROR";
    const PLAIN: Record<string, string> = {
      INSTRUMENT_DECLINED: "That payment method was declined. Please try another one in PayPal.",
      PAYER_ACTION_REQUIRED: "PayPal needs one more step from the payer. Please try again.",
      ORDER_ALREADY_CAPTURED: "This payment is already complete.",
      PAYEE_ACCOUNT_RESTRICTED: "The shop's PayPal account cannot receive payments right now.",
      PAYEE_ACCOUNT_INVALID: "The shop's PayPal account is not set up correctly.",
    };
    return { status: e.statusCode, issue, plain: PLAIN[issue] ?? "PayPal could not complete this step. Please try again.", debugId: body?.debug_id ?? null };
  }
  return { status: 500, issue: "UNKNOWN", plain: "PayPal could not complete this step. Please try again.", debugId: null };
}
