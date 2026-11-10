/**
 * The giver's side of Giftwise in English and Spanish: the gift page, the giving card, sharing, PayPal's messages
 * and the receipt. Spanish uses "usted" and "su", which reads the same for she, he or they. The family's own words
 * (the note, need titles) stay as written, except the sample household, whose Spanish is below.
 * Client-safe: the components import it directly, so only the language crosses from server to client.
 */

import { fullCheckByYear } from "@/lib/rules/params";

export type Lang = "en" | "es";
export const asLang = (v: unknown): Lang => (v === "es" ? "es" : "en");

const MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthIn = (lang: Lang, month: string) => (lang === "es" ? MONTHS_ES : MONTHS_EN)[Number(month.slice(5, 7)) - 1];
/** A check's month with its year ("January 2027", "enero de 2027"): the full check differs by year, so it is always named with it. */
export const checkMonthIn = (lang: Lang, month: string) => `${monthIn(lang, month)}${lang === "es" ? " de " : " "}${month.slice(0, 4)}`;

/** "Maya's ABLE account" reads "Cuenta ABLE de Maya" in Spanish. */
export function payeeIn(lang: Lang, payee: string) {
  if (lang !== "es") return payee;
  const m = /^(.+)'s ABLE account$/.exec(payee);
  return m ? `Cuenta ABLE de ${m[1]}` : payee;
}

/** The payee inside a sentence: "Se paga directamente a la cuenta ABLE de Maya". */
export function payeeInline(lang: Lang, payee: string) {
  const p = payeeIn(lang, payee);
  return lang === "es" && p.startsWith("Cuenta ABLE") ? `la c${p.slice(1)}` : p;
}

/** The sample household's own words in Spanish; any other page shows the family's words as written. */
const SAMPLE_ES: Record<string, string> = {
  "Wheelchair repair": "Reparación de la silla de ruedas",
  "New push rims and a brake adjustment.": "Aros nuevos para empujar y un ajuste de frenos.",
  "Laptop for college": "Computadora portátil para la universidad",
  "For her online classes this spring.": "Para sus clases en línea esta primavera.",
  "Electric bill, this month": "Factura de luz de este mes",
  "Utilities count as housing support, so this goes to her ABLE account and she pays the bill herself.": "Los servicios cuentan como apoyo para vivienda, así que esto va a su cuenta ABLE y ella paga la factura.",
  "Therapy co-pay": "Copago de terapia",
  "Weekly physical therapy.": "Fisioterapia semanal.",
  "savings for later": "ahorro para después",
  "Maya is 29 and lives on her own. She uses a wheelchair and is starting community college. Thank you for helping with these. Every gift on this page is paid straight to the shop or clinic, or to her ABLE account, so her SSI check stays the same. With love, Rosa (her mom)":
    "Maya tiene 29 años y vive sola. Usa silla de ruedas y está empezando la universidad comunitaria. Gracias por ayudar con esto. Cada regalo de esta página se paga directamente a la tienda o la clínica, o a su cuenta ABLE, así su cheque de SSI no cambia. Con cariño, Rosa (su mamá)",
};
export const sampleIn = (lang: Lang, s: string, isSample = true) => (lang === "es" && isSample ? (SAMPLE_ES[s] ?? s) : s);

type Words = { Poss: string; poss: string; hers: string };

const EN = {
  langSwitch: { label: "En español", lang: "es" as Lang },
  help: (n: string) => `Help ${n}`,
  sampleNote: "Sample household for the demo. Names and shops are fictional.",
  madeNote: (own: boolean) =>
    `Made from a fundraiser page, in the PayPal sandbox. Figures use the federal SSI amount for the month each check is paid (${fullCheckByYear()}) and ${own ? "the person's own situation, as the organizer gave it" : "a sample situation until the organizer adds theirs"}. In the sandbox, every shop is paid through one test business account.`,
  /** Under her check on the gift page: whose facts it is computed from. */
  situationOwn: (line: string) => `From ${line}.`,
  situationSample: (w: Words) => `A sample situation until the organizer adds ${w.hers}: one adult on ${w.poss} own, no other income.`,
  needsH: (n: string) => `What ${n} needs`,
  paidStraightTo: "Paid straight to",
  givenToGo: (g: string, r: string) => `${g} given, ${r} to go`,
  paidBy: (who: string | null) => (who ? `Paid by ${who}` : "Paid"),
  paidLine: (payee: string, w: Words, month: string, amt: string, stays: boolean) => `Paid to ${payee}. ${w.Poss} ${month} check ${stays ? "stays" : "is"} ${amt}.`,
  /** The line right above a need's PayPal button: what this payment is, and who gets it. */
  needPay: (amt: string, payee: string) => `You pay ${amt}, straight to ${payee}.`,
  needGoes: (payee: string) => `Goes straight to ${payee}.`,
  /** The organizer's own PayPal payee for a need, masked: "PayPal account eastga…@example.com." */
  payeeAccount: (masked: string) => `PayPal account ${masked}.`,
  orderLine: (id: string) => `PayPal order ${id}`,
  seeReceipt: "See the receipt",
  giveAny: "Give any amount",
  yourGift: "Your gift",
  yourGiftAria: "Your gift in dollars",
  chips: "Suggested amounts",
  chipAll: (n: number) => `All ${n} needs`,
  hintMin: "Type $1 or more to give.",
  hintNumber: "Type an amount in dollars, like 50.",
  overMax: "One gift can be up to $10,000. Type $10,000 or less.",
  sendsHere: "Giftwise sends it here",
  checkSetBy: (w: Words, month: string, giftMonth: string) => `${w.Poss} ${month} check (set by gifts in ${giftMonth})`,
  lagNote: (giftMonth: string, month: string) => `Social Security sets each check from the income two months before, so a gift in ${giftMonth} counts toward the ${month} check.`,
  checkStays: (amt: string, year: string, full = true) => (full ? `It stays ${amt} with Giftwise, the full ${year} check.` : `It stays ${amt} with Giftwise, the same as with no gift.`),
  checkIs: (amt: string) => `With Giftwise it is ${amt}.`,
  asCash: "As cash",
  withGiftwise: "With Giftwise",
  nothingTo: (w: Words) => `Nothing goes to ${w.poss} bank or to Giftwise.`,
  /** The total, right above the PayPal button: "You pay" + the amount + the rest. */
  payYou: "You pay",
  payRest: (n: number, payee: string) =>
    n === 1
      ? `in one PayPal payment, straight to ${payee}. Giftwise adds no fee.`
      : `in one PayPal payment. PayPal pays ${n === 2 ? "both" : `all ${n}`} directly, and Giftwise adds no fee.`,
  unplaced: (amt: string) => `${amt} has no benefit-safe place right now, so it is not included.`,
  thanks: (who: string | null) => `Thank you${who ? `, ${who}` : ""}.`,
  doneLine: (amt: string) => `You gave ${amt} in one PayPal payment.`,
  /** What happens next, in one sentence: who has the money, and the check it keeps. */
  paidNext: (payees: string[], w: Words, month: string, amt: string) =>
    `PayPal paid ${payees.length === 1 ? payees[0] : payees.length === 2 ? `${payees[0]} and ${payees[1]}` : `all ${payees.length} recipients`}. ${w.Poss} ${month} check stays ${amt}.`,
  savingsLater: "savings for later",
  /** What one payee is paid for, when an order pays it on more than one line: "Electric bill and savings for later". */
  joinFor: (titles: string[]) => (titles.length <= 1 ? (titles[0] ?? "") : `${titles.slice(0, -1).join(", ")} and ${titles.at(-1)}`),
  seeOnReport: (name: string, month: string) => `See it on ${name}'s ${month} report`,
  giveAgain: "Give again",
  monthly: "Give this every month",
  monthlyWorking: "Setting it up…",
  monthlyFailed: "Could not start the monthly gift.",
  noServer: "Could not reach the server. Try again.",
  monthH: (n: string) => `${n}'s month`,
  checkMonth: (month: string, year: string, giftMonth: string) => `SSI check for ${month} ${year} (set by gifts in ${giftMonth})`,
  givenSoFar: "Given so far",
  stillNeeded: "Still needed",
  savedAble: (w: Words) => `Saved in ${w.poss} ABLE account`,
  counted: "Counted as income",
  latestReceipt: "See the latest receipt",
  sampleReceipt: "See a sample receipt from a recorded sandbox gift",
  reportLink: (n: string) => `${n}'s report to Social Security`,
  easyLink: (n: string) => `The same report in Easy Read, for ${n}`,
  calendarLink: (n: string) => `${n}'s benefit calendar`,
  yearLink: (n: string) => `See ${n}'s year`,
  cashQ: "Prefer to give cash?",
  cashText: (w: Words, cashCheck: string, kept: string, month: string, isFull = true) =>
    `Cash counts as ${w.poss} income. A $300 cash gift would lower ${w.poss} ${month} check to ${cashCheck}. Paying for one of these needs instead keeps ${w.poss} ${isFull ? `full ${month} check of ${kept}` : `${month} check at ${kept}`}.`,
  checkAny: "Check any gift",
  sandboxTitle: "Testing in the sandbox",
  sandboxHolds: (sample: boolean): string => (sample ? "Test login and card, the organizer's view, and reset" : "Test login and card"),
  organizerView: "See the organizer's view of this page",
  sandboxText: "No real money moves. In the PayPal window, log in with this sandbox buyer:",
  sandboxCard: "Or pay as a guest with Debit or Credit Card, using PayPal's test card 4012 8888 8888 1881, any future date and any 3-digit code.",
  sandboxEmail: "Sandbox email",
  password: "Password",
  copyPassword: "Copy the password",
  copiedPassword: "Copied",
  showPassword: "Show it",
  hidePassword: "Hide it",
  sandboxAccountNote: "This is PayPal's sandbox test buyer: a practice account that works only in the sandbox checkout window, where no real money moves.",
  reset: "Reset the sample page",
  resetting: "Resetting…",
  shareTitle: "Share this page",
  shareText: "Anyone you send it to gives the same way, straight to the shop or the ABLE account.",
  shareBtn: "Share or copy the link",
  copied: "Link copied",
  showQr: "Show a QR code",
  qrAria: (url: string) => `QR code for ${url}`,
  shareMessage: (n: string, w: Words) => `Help ${n}: every gift is paid through PayPal straight to the shop or ${w.poss} ABLE account, so ${w.poss} SSI check stays whole.`,
  ppLoading: "Loading PayPal…",
  ppUnavailable: "PayPal checkout is not connected on this server yet.",
  ppCompleting: "Completing the payment with PayPal…",
  ppCancelled: "Payment cancelled. Nothing was charged.",
  ppLoadFailed: "PayPal could not load. Check your connection.",
  ppStopped: "PayPal stopped before the payment finished.",
  ppFailed: "PayPal could not complete the payment.",
  ppRetry: "Try again",
  realWorldNote: "",
  /** What a real deployment does with the ABLE share (IAble's Ugift page, ABLE United's gifting page). */
  ableReal: (w: Words) => `For real, the ABLE share goes to ${w.poss} ABLE plan's own gift page, by a six-character Ugift code or the account's gifting link; in this sandbox it is a PayPal test account.`,
  ableRealSource: "How a Ugift code works (IAble)",
  seeItem: (host: string) => `See it at ${host}`,
  closed: (n: string) => `${n}'s page is closed to new gifts. Thank you to everyone who gave; the receipts below stay public.`,
};

export type GiftText = typeof EN;

const ES: GiftText = {
  langSwitch: { label: "In English", lang: "en" },
  help: (n) => `Ayude a ${n}`,
  sampleNote: "Hogar de muestra para la demostración. Los nombres y las tiendas son ficticios.",
  madeNote: (own) =>
    `Hecha a partir de una página de recaudación de fondos, en el sandbox de PayPal. Las cifras usan el monto federal de SSI del mes en que se paga cada cheque (${fullCheckByYear().replace(" in ", " en ").replace(" from January ", " desde enero de ")}) y ${own ? "la situación propia de la persona, como la indicó quien organiza" : "una situación de muestra hasta que quien organiza agregue la suya"}. En el sandbox, todas las tiendas reciben el pago en una sola cuenta comercial de prueba.`,
  situationOwn: (line) => `Según ${line}.`,
  situationSample: () => "Una situación de muestra hasta que quien organiza agregue la suya: una persona adulta que vive sola, sin otros ingresos.",
  needsH: (n) => `Lo que ${n} necesita`,
  paidStraightTo: "Se paga directamente a",
  givenToGo: (g, r) => `${g} dado, faltan ${r}`,
  paidBy: (who) => (who ? `Pagado por ${who}` : "Pagado"),
  paidLine: (payee, _w, month, amt, stays) => `Pagado a ${payee}. Su cheque de ${month} ${stays ? "se mantiene en" : "es de"} ${amt}.`,
  needPay: (amt, payee) => `Usted paga ${amt} directamente a ${payee}.`,
  needGoes: (payee) => `Va directamente a ${payee}.`,
  payeeAccount: (masked) => `Cuenta de PayPal ${masked}.`,
  orderLine: (id) => `Orden de PayPal ${id}`,
  seeReceipt: "Ver el recibo",
  giveAny: "Dé la cantidad que quiera",
  yourGift: "Su regalo",
  yourGiftAria: "Su regalo en dólares",
  chips: "Cantidades sugeridas",
  chipAll: (n) => `Las ${n} necesidades`,
  hintMin: "Escriba $1 o más para dar.",
  hintNumber: "Escriba una cantidad en dólares, como 50.",
  overMax: "Un regalo puede ser de hasta $10,000. Escriba $10,000 o menos.",
  sendsHere: "Giftwise lo envía aquí",
  checkSetBy: (_w, month, giftMonth) => `Su cheque de ${month} (según los regalos de ${giftMonth})`,
  lagNote: (giftMonth, month) => `El Seguro Social calcula cada cheque con los ingresos de dos meses antes, así que un regalo en ${giftMonth} cuenta para el cheque de ${month}.`,
  checkStays: (amt, year, full = true) => (full ? `Con Giftwise se mantiene en ${amt}, el cheque completo de ${year}.` : `Con Giftwise se mantiene en ${amt}, lo mismo que sin regalo.`),
  checkIs: (amt) => `Con Giftwise es de ${amt}.`,
  asCash: "En efectivo",
  withGiftwise: "Con Giftwise",
  nothingTo: () => "Nada va a su banco ni a Giftwise.",
  payYou: "Usted paga",
  payRest: (n, payee) =>
    n === 1
      ? `en un solo pago de PayPal, directamente a ${payee}. Giftwise no agrega ninguna comisión.`
      : `en un solo pago de PayPal. PayPal les paga directamente a ${n === 2 ? "los dos" : `los ${n}`}, y Giftwise no agrega ninguna comisión.`,
  unplaced: (amt) => `${amt} no tiene ahora un destino que proteja sus beneficios, así que no se incluye.`,
  thanks: (who) => `Gracias${who ? `, ${who}` : ""}.`,
  doneLine: (amt) => `Usted dio ${amt} en un solo pago de PayPal.`,
  paidNext: (payees, _w, month, amt) =>
    `PayPal ${payees.length === 1 ? `le pagó a ${payees[0]}` : payees.length === 2 ? `les pagó a ${payees[0]} y a ${payees[1]}` : `les pagó a los ${payees.length} destinatarios`}. Su cheque de ${month} se mantiene en ${amt}.`,
  savingsLater: "ahorro para después",
  joinFor: (titles) => (titles.length <= 1 ? (titles[0] ?? "") : `${titles.slice(0, -1).join(", ")} y ${titles.at(-1)}`),
  seeOnReport: (name, month) => `Verlo en el informe de ${month} de ${name}`,
  giveAgain: "Dar otra vez",
  monthly: "Dar esto cada mes",
  monthlyWorking: "Preparándolo…",
  monthlyFailed: "No se pudo empezar el regalo mensual.",
  noServer: "No se pudo conectar con el servidor. Inténtelo de nuevo.",
  monthH: (n) => `El mes de ${n}`,
  checkMonth: (month, year, giftMonth) => `Cheque de SSI de ${month} de ${year} (según los regalos de ${giftMonth})`,
  givenSoFar: "Dado hasta ahora",
  stillNeeded: "Todavía falta",
  savedAble: () => "Ahorrado en su cuenta ABLE",
  counted: "Contado como ingreso",
  latestReceipt: "Ver el último recibo",
  sampleReceipt: "Ver un recibo de muestra de un regalo grabado en el sandbox",
  reportLink: (n) => `El informe completo de ${n} para el Seguro Social (en inglés)`,
  easyLink: (n) => `El informe en lectura fácil, en español, para ${n}`,
  calendarLink: (n) => `El calendario de beneficios de ${n} (en inglés)`,
  yearLink: (n) => `Ver el año de ${n} (en inglés)`,
  cashQ: "¿Prefiere dar efectivo?",
  cashText: (_w, cashCheck, kept, month, isFull = true) =>
    `El efectivo cuenta como ingreso. Un regalo de $300 en efectivo bajaría su cheque de ${month} a ${cashCheck}. Pagar una de estas necesidades, en cambio, mantiene su cheque ${isFull ? `completo de ${month}, de ${kept}` : `de ${month} en ${kept}`}.`,
  checkAny: "Revisar cualquier regalo (en inglés)",
  sandboxTitle: "Pruebas en el sandbox",
  sandboxHolds: (sample) => (sample ? "Acceso y tarjeta de prueba, la vista del organizador y reiniciar" : "Acceso y tarjeta de prueba"),
  organizerView: "Ver esta página como la ve quien la organiza",
  sandboxText: "No se mueve dinero real. En la ventana de PayPal, inicie sesión con este comprador de prueba:",
  sandboxCard: "O pague como invitado con tarjeta de débito o crédito, con la tarjeta de prueba de PayPal 4012 8888 8888 1881, cualquier fecha futura y cualquier código de 3 dígitos.",
  sandboxEmail: "Correo de prueba",
  password: "Contraseña",
  copyPassword: "Copiar la contraseña",
  copiedPassword: "Copiada",
  showPassword: "Mostrarla",
  hidePassword: "Ocultarla",
  sandboxAccountNote: "Es el comprador de prueba del sandbox de PayPal: una cuenta de práctica que solo funciona en la ventana de pago del sandbox, donde no se mueve dinero real.",
  reset: "Restablecer la página de muestra",
  resetting: "Restableciendo…",
  shareTitle: "Compartir esta página",
  shareText: "Quien la reciba da de la misma manera, directamente a la tienda o a la cuenta ABLE.",
  shareBtn: "Compartir o copiar el enlace",
  copied: "Enlace copiado",
  showQr: "Mostrar un código QR",
  qrAria: (url) => `Código QR para ${url}`,
  shareMessage: (n) => `Ayude a ${n}: cada regalo se paga por PayPal directamente a la tienda o a su cuenta ABLE, así su cheque de SSI se mantiene completo.`,
  ppLoading: "Cargando PayPal…",
  ppUnavailable: "El pago con PayPal todavía no está conectado en este servidor.",
  ppCompleting: "Completando el pago con PayPal…",
  ppCancelled: "Pago cancelado. No se cobró nada.",
  ppLoadFailed: "PayPal no pudo cargar. Revise su conexión.",
  ppStopped: "PayPal se detuvo antes de terminar el pago.",
  ppFailed: "PayPal no pudo completar el pago.",
  ppRetry: "Intentar de nuevo",
  realWorldNote: "Estas respuestas están en inglés, cada una con sus fuentes.",
  ableReal: () => "En la vida real, la parte de ABLE va a la página de regalos de su plan ABLE, con un código Ugift de seis caracteres o el enlace de regalos de la cuenta; en este sandbox es una cuenta de prueba de PayPal.",
  ableRealSource: "Cómo funciona un código Ugift (IAble, en inglés)",
  seeItem: (host) => `Verlo en ${host}`,
  closed: (n) => `La página de ${n} ya no recibe regalos. Gracias a todas las personas que dieron; los recibos siguen públicos.`,
};

export const giftText = (lang: Lang): GiftText => (lang === "es" ? ES : EN);

/** "the person's" starts a sentence as "The person's". */
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The receipt page and its live checks. */
const RECEIPT_EN = {
  title: "Receipt",
  lede: "A public record of one gift: who was paid, how much, and the rule that kept the SSI check whole. Anyone with this link can check it against PayPal.",
  given: "Given",
  started: "Started, not yet completed",
  /** n recipients (payees), paid on lines purchase units; a payee paid on two lines is one recipient. */
  sub: (payer: string | undefined, n: number, lines: number, when: string) =>
    `${payer ? `From ${payer}, ` : ""}${n === 1 ? "to one recipient" : `split across ${n} recipients`}${lines > n ? ` on ${lines} lines` : ""} in one PayPal payment on ${when}.`,
  countedAs: (hers: string) => `Counted as ${hers} income`,
  checkAfter: (hers: string, month: string) => `${cap(hers)} ${month} SSI check after this gift`,
  sentTo: (hers: string) => `Sent to ${hers} bank or to Giftwise`,
  orderLine: (id: string) => `PayPal order ${id}`,
  /** What happens next, in one sentence. */
  next: (payees: string[], hers: string, month: string, amt: string, stays: boolean) =>
    `PayPal paid ${payees.length === 1 ? payees[0] : payees.length === 2 ? `${payees[0]} and ${payees[1]}` : `all ${payees.length} recipients`}. ${cap(hers)} ${month} check ${stays ? "stays" : "is"} ${amt}.`,
  nextStarted: "Nothing is paid until the giver approves it in PayPal.",
  where: "Where every dollar went",
  routeVendor: "Paid straight to the shop",
  /** A line paid to the organizer's own PayPal payee for the need, masked. */
  payeeAccount: (masked: string) => `PayPal account ${masked}.`,
  routeAble: "Paid to the ABLE account",
  savingsIn: (hers: string) => `Savings in ${hers} ABLE account`,
  ableHandoff: (hers: string) => `In this sandbox, ${hers} ABLE account is a PayPal test account. For real, Giftwise sends the giver to the ABLE plan's own gift page for the ABLE share: with a Ugift plan, the giver types the account's six-character Ugift code (shown like 1A2-B3C) at UgiftABLE.com, which opens the owner's personal gifting page; plans such as ABLE United give each account its own gifting link. The shops are still paid through PayPal.`,
  ableHandoffSource: "How a Ugift code works (IAble)",
  capture: (id: string) => `PayPal capture ${id}`,
  order: (id: string, status: string) => `PayPal order ${id}, ${status}`,
  why: (hers: string) => `Why ${hers} check stays the same`,
  sources: "Sources",
  version: (v: string) => `Rules version ${v}. Checked by the Giftwise rules engine before PayPal created the order.`,
  checkIt: "Check it yourself",
  byAgent: ", started by an AI agent for the giver to approve",
  hashNote: "Each line is one entry in the Giftwise ledger. Every entry’s fingerprint includes the one before it, so no past entry can change without the check above failing.",
  onReport: (hers: string, month: string) => `See this gift on ${hers} ${month} report to Social Security`,
  earlierRound: "From an earlier round of the sample page. The page has been reset since, so this gift no longer counts toward its needs or its report. This receipt and PayPal’s record stay as they were.",
  back: (name: string) => `Back to ${name}’s page`,
  recorded: (when: string) => `A recorded sandbox gift from ${when}, kept with the sample page so this receipt can be read without paying. It sits in an earlier round, so it does not count toward the page's open needs; it is listed on that month's report, whose check page asks PayPal for each capture. Check with PayPal now asks PayPal for this order live.`,
  possessive: (name: string | undefined) => (name ? `${name}’s` : "the person’s"),
  checkPayPal: "Check with PayPal now",
  asking: "Asking PayPal…",
  verifyLedger: "Verify the ledger",
  checking: "Checking…",
  paypalSays: "PayPal says this order is",
  ableUnit: "ABLE account",
  needUnit: (n: string) => `Need ${n}`,
  captureLine: (id: string, status: string) => `capture ${id}, ${status}`,
  notCaptured: "not captured",
  ledgerOk: (n: number) => `Ledger intact: all ${n} entries recomputed and matched.`,
  ledgerBroken: (at: number | undefined) => `Ledger check found a change at entry ${at}.`,
  paypalNoAnswer: "PayPal did not answer. Please try again.",
  ledgerNoRun: "The ledger check did not run. Please try again.",
  status: {
    CREATED: "waiting for the donor to approve",
    PAYER_ACTION_REQUIRED: "waiting for the donor to approve",
    SAVED: "saved, not yet paid",
    APPROVED: "approved, finishing the payment",
    COMPLETED: "completed",
    VOIDED: "cancelled, nothing was charged",
  } as Record<string, string>,
  events: {
    "paypal.order.created": "PayPal order created",
    "paypal.routed_order.created": "PayPal order created, split by the rules",
    "paypal.order.captured": "Payment completed by PayPal",
    "paypal.webhook.checkout.order.approved": "PayPal reported the giver's approval (webhook)",
    "paypal.webhook.payment.capture.completed": "PayPal confirmed a payment (webhook)",
    "paypal.webhook.payment.capture.refunded": "PayPal reported a refund (webhook)",
    "paypal.webhook.payment.capture.reversed": "PayPal reported a reversal (webhook)",
    "paypal.webhook.payment.capture.denied": "PayPal reported a declined payment (webhook)",
  } as Record<string, string>,
};
export type ReceiptText = typeof RECEIPT_EN;

const RECEIPT_ES: ReceiptText = {
  title: "Recibo",
  lede: "Un registro público de un regalo: a quién se pagó, cuánto y la regla que mantuvo completo el cheque de SSI. Cualquier persona con este enlace puede comprobarlo con PayPal.",
  given: "Dado",
  started: "Empezado, todavía sin completar",
  sub: (payer, n, lines, when) =>
    `${payer ? `De ${payer}, ` : ""}${n === 1 ? "a un destinatario" : `repartido entre ${n} destinatarios`}${lines > n ? ` en ${lines} líneas` : ""} en un solo pago de PayPal el ${when.replace(/\.$/, "")}.`,
  countedAs: () => "Contado como ingreso",
  checkAfter: (_hers, month) => `Cheque de SSI de ${month} después de este regalo`,
  sentTo: () => "Enviado a su banco o a Giftwise",
  orderLine: (id) => `Orden de PayPal ${id}`,
  next: (payees, _hers, month, amt, stays) =>
    `PayPal ${payees.length === 1 ? `le pagó a ${payees[0]}` : payees.length === 2 ? `les pagó a ${payees[0]} y a ${payees[1]}` : `les pagó a los ${payees.length} destinatarios`}. Su cheque de ${month} ${stays ? "se mantiene en" : "es de"} ${amt}.`,
  nextStarted: "No se paga nada hasta que quien da lo apruebe en PayPal.",
  where: "A dónde fue cada dólar",
  routeVendor: "Se pagó directamente a la tienda",
  payeeAccount: (masked) => `Cuenta de PayPal ${masked}.`,
  routeAble: "Se pagó a la cuenta ABLE",
  savingsIn: () => "Ahorro en su cuenta ABLE",
  ableHandoff: () => "En este sandbox, su cuenta ABLE es una cuenta de prueba de PayPal. En la vida real, Giftwise lleva a quien regala a la página de regalos del propio plan ABLE para la parte de ABLE: con un plan Ugift, se escribe el código Ugift de seis caracteres de la cuenta (como 1A2-B3C) en UgiftABLE.com, que abre su página personal de regalos; planes como ABLE United dan a cada cuenta su propio enlace de regalos. Las tiendas se siguen pagando con PayPal.",
  ableHandoffSource: "Cómo funciona un código Ugift (IAble, en inglés)",
  capture: (id) => `Cobro de PayPal ${id}`,
  order: (id, status) => `Orden de PayPal ${id}, ${status}`,
  why: () => "Por qué su cheque no cambia",
  sources: "Fuentes (en inglés)",
  version: (v) => `Versión de las reglas ${v}. El motor de reglas de Giftwise lo revisó antes de que PayPal creara la orden.`,
  checkIt: "Compruébelo usted",
  byAgent: ", empezado por un asistente de IA para que quien da lo apruebe",
  hashNote: "Cada línea es una entrada del registro de Giftwise. La huella de cada entrada incluye la de la anterior, así que ninguna entrada pasada puede cambiar sin que falle la comprobación de arriba.",
  onReport: (_hers, month) => `Ver este regalo en el informe de ${month} en lectura fácil`,
  earlierRound: "De una ronda anterior de la página de muestra. La página se reinició después, así que este regalo ya no cuenta para sus necesidades ni para su informe. Este recibo y el registro de PayPal siguen como estaban.",
  back: (name) => `Volver a la página de ${name}`,
  recorded: (when) => `Un regalo grabado en el sandbox el ${when}, guardado con la página de muestra para que este recibo pueda leerse sin pagar. Está en una ronda anterior, así que no cuenta para las necesidades abiertas de la página; aparece en el informe de ese mes, cuya página de comprobación le pregunta a PayPal por cada cobro. Comprobar con PayPal ahora le pregunta a PayPal por esta orden en vivo.`,
  possessive: () => "su",
  checkPayPal: "Comprobar con PayPal ahora",
  asking: "Preguntando a PayPal…",
  verifyLedger: "Verificar el registro",
  checking: "Comprobando…",
  paypalSays: "PayPal dice que esta orden está",
  ableUnit: "Cuenta ABLE",
  needUnit: (n) => `Necesidad ${n}`,
  captureLine: (id, status) => `cobro ${id}, ${status}`,
  notCaptured: "sin cobrar",
  ledgerOk: (n) => `Registro intacto: las ${n} entradas se recalcularon y coinciden.`,
  ledgerBroken: (at) => `La comprobación encontró un cambio en la entrada ${at}.`,
  paypalNoAnswer: "PayPal no respondió. Inténtelo de nuevo.",
  ledgerNoRun: "La comprobación del registro no se pudo hacer. Inténtelo de nuevo.",
  status: {
    CREATED: "esperando la aprobación de quien da",
    PAYER_ACTION_REQUIRED: "esperando la aprobación de quien da",
    SAVED: "guardada, todavía sin pagar",
    APPROVED: "aprobada, terminando el pago",
    COMPLETED: "completada",
    VOIDED: "cancelada, no se cobró nada",
  },
  events: {
    "paypal.order.created": "Orden de PayPal creada",
    "paypal.routed_order.created": "Orden de PayPal creada, repartida según las reglas",
    "paypal.order.captured": "Pago completado por PayPal",
    "paypal.webhook.checkout.order.approved": "PayPal informó la aprobación de quien da (webhook)",
    "paypal.webhook.payment.capture.completed": "PayPal confirmó un pago (webhook)",
    "paypal.webhook.payment.capture.refunded": "PayPal informó un reembolso (webhook)",
    "paypal.webhook.payment.capture.reversed": "PayPal informó una reversión (webhook)",
    "paypal.webhook.payment.capture.denied": "PayPal informó un pago rechazado (webhook)",
  },
};
export const receiptText = (lang: Lang): ReceiptText => (lang === "es" ? RECEIPT_ES : RECEIPT_EN);
