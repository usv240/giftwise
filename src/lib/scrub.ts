/**
 * Masking shared by the logger and error tracking. No Node imports, so the client bundle can use it too.
 * Emails become a***@domain, phone numbers and photo bytes become markers, payees become "[payee]", amounts
 * "[amount]", and any key that names a secret is hidden whatever it holds.
 */

export type Fields = Record<string, unknown>;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
/** A US phone number shape (3-3-4 with optional country code); dates and PayPal ids do not match it. */
const PHONE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
/** A long run of base64 or a data URL: a photo or a document, never worth a log line. */
const BLOB = /data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]{20,}|[A-Za-z0-9+/]{400,}={0,2}/g;

/** Keys whose values never reach a log line, whatever they hold. */
const HIDDEN = /(secret|token|password|authorization|api[-_]?key|cookie|photo|base64|image|data_?url|webhook_?url|signature)/i;
/** Keys that name a payee or a person: replaced by a short marker so a line can say "a payee" and never who. */
const PAYEE = /(payee|receiver|recipient|payer|giver|caregiver)/i;
/** Amounts are never logged to the cent. */
const AMOUNT = /(amount|total|balance|funded|value)$/i;
const EMAILKEY = /e-?mail/i;

export const maskEmail = (s: string) => s.replace(EMAIL, (m) => `${m[0]}***@${m.slice(m.indexOf("@") + 1)}`);

/** Mask one string: emails to a***@domain, phone numbers and photo bytes to markers, and long text cut short. */
export function maskText(s: string) {
  const out = maskEmail(s).replace(BLOB, "[bytes]").replace(PHONE, "[phone]");
  return out.length > 300 ? `${out.slice(0, 300)}… (${out.length} chars)` : out;
}

/** Mask a whole value, however nested. Objects keep their shape so a line stays easy to read. */
export function mask(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return maskText(value);
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return { name: value.name, message: maskText(value.message), stack: value.stack?.split("\n").slice(0, 6).map(maskText).join("\n") };
  if (depth > 5) return "[deep]";
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => mask(v, depth + 1));
  if (typeof value === "object") {
    const out: Fields = {};
    for (const [k, v] of Object.entries(value as Fields)) {
      if (HIDDEN.test(k)) out[k] = "[hidden]";
      else if (EMAILKEY.test(k)) out[k] = typeof v === "string" ? maskEmail(v) : mask(v, depth + 1);
      else if (PAYEE.test(k)) out[k] = typeof v === "string" ? (v.includes("@") ? maskEmail(v) : "[payee]") : mask(v, depth + 1);
      else if (AMOUNT.test(k) && (typeof v === "number" || (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v)))) out[k] = "[amount]";
      else out[k] = mask(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

/** Sentry's beforeSend: the same masking over the event's message, exception values, breadcrumbs, request and extra. */
export function scrubEvent<E extends Fields>(event: E): E {
  const e = event as Fields;
  if (typeof e.message === "string") e.message = maskText(e.message);
  const ex = e.exception as { values?: { value?: string }[] } | undefined;
  for (const v of ex?.values ?? []) if (typeof v.value === "string") v.value = maskText(v.value);
  if (e.request && typeof e.request === "object") {
    const r = e.request as Fields;
    delete r.cookies;
    delete r.data;
    if (r.headers && typeof r.headers === "object") {
      const h = r.headers as Fields;
      for (const k of Object.keys(h)) if (/cookie|authorization|x-api-key|x-forwarded-for|x-real-ip/i.test(k)) delete h[k];
    }
    if (typeof r.url === "string") r.url = maskText(r.url);
  }
  if (e.user) e.user = undefined;
  if (e.extra) e.extra = mask(e.extra) as Fields;
  if (e.contexts) e.contexts = mask(e.contexts) as Fields;
  if (Array.isArray(e.breadcrumbs)) e.breadcrumbs = e.breadcrumbs.map((b) => mask(b));
  return event;
}
