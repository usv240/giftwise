/** The rule sentence on a need, in Spanish (server side: it reads the Easy Read module's category words). */
import type { GiftResult } from "../rules";
import { P, pmv, usd, vtr, type HouseholdTest } from "../rules";
import { CATEGORY_ES } from "../report/easy";
import { checkMonthIn } from "./gift";

/** "1 de diciembre de 2026", from "2026-12-01". */
const firstEs = (day: string) => `1 de ${checkMonthIn("es", day.slice(0, 7))}`;

/** Why the check is $0 over the savings limit (R-RES-01, R-ABLE-03), as overLimitWhy() says it in English. */
const overLimitEs = (s: GiftResult["resourcesAfter"]) =>
  s.status === "able_suspension"
    ? `Eso pasa el límite de ${usd(s.limit)} por la cuenta ABLE, así que mientras siga por encima no se paga SSI en efectivo, y Medicaid continúa`
    : `Eso pasa el límite de ${usd(s.limit)}, así que no se paga SSI mientras siga por encima`;

/** Follows the same branches as the engine's explanation. */
export function ruleSentenceEs(r: GiftResult, couple = false) {
  const before = r.resourcesBefore;
  // Resources already over the limit on the balances she states: said after the rule, as in English.
  const over = before.over
    ? ` Sus recursos contables el ${firstEs(before.on)} son ${usd(before.countable)}${before.ableExcess > 0 ? `: ${usd(before.other)} en ahorros y ${usd(before.ableExcess)}, la parte de su cuenta ABLE por encima de $100,000` : ""}. ${overLimitEs(before)}.`
    : "";
  const loan = r.treatment.note === "not_a_loan" ? "La SSA no lo trataría como un préstamo, así que cuenta como la misma ayuda dada. " : "";
  const household = householdEs(r.trace.household, couple, r.trace.paymentMonth);
  return loan + ruleOnly(r, couple) + (household ? ` ${household}` : "") + over;
}

/** The household sentence (R-SHEL-08), as householdSentence() says it in English. */
export function householdEs(h: HouseholdTest | null, couple: boolean, payMonth: string) {
  if (!h || h.rule === "none") return "";
  const mes = checkMonthIn("es", payMonth);
  const paid =
    h.share !== null ? `paga ${usd(h.pays)} de su parte de ${usd(h.share)} de los gastos` : h.pays > 0 ? `paga ${usd(h.pays)} de los gastos, y no se sabe cuál es su parte` : "no paga nada de los gastos";
  const end =
    h.share !== null
      ? ` Pagar al menos ${usd(Math.round(Math.max(0, h.share - P.sharingTolerance) * 100) / 100)} al mes de los gastos del hogar terminaría eso.`
      : ` Pagar su parte de los gastos del hogar, o hasta ${usd(P.sharingTolerance)} menos, terminaría eso.`;
  if (h.rule === "vtr") return `Vive en el hogar de otra persona y ${paid}, así que su cheque de ${mes} ya tiene una reducción de un tercio, ${usd(vtr(couple, payMonth))}, con o sin regalo.${end}`;
  const valued = h.share !== null ? `${usd(h.value)}, su parte menos lo que paga` : `${usd(h.value)}, el valor máximo presunto, porque no se conocen los gastos del hogar`;
  return `Vive en el hogar de otra persona y ${paid}, así que la vivienda que le da ese hogar cuenta como apoyo para vivienda, con o sin regalo: ${valued}, hasta ${usd(pmv(couple, payMonth))} al mes junto con cualquier otra ayuda para vivienda.${end}`;
}

function ruleOnly(r: GiftResult, couple: boolean) {
  const t = r.treatment;
  const mes = checkMonthIn("es", r.trace.paymentMonth);
  const label = CATEGORY_ES[r.gift.category];
  const stays = `Su cheque de ${mes} se mantiene en ${usd(r.checkAfter)}.`;
  if (t.kind === "not_possible")
    return t.note === "not_able_eligible"
      ? "Una cuenta ABLE es para personas cuya discapacidad empezó antes de los 46 años. Otra forma de dar funciona mejor aquí."
      : "La vivienda se paga como una factura, no se regala como un artículo. Puede pagar la factura a través de su cuenta ABLE.";
  if (t.note === "loan" && r.gift.delivery === "cash")
    return `Un préstamo que debe devolver no es ingreso, así que su cheque de ${mes} se mantiene en ${usd(r.checkAfter)}. Devolverlo después no baja su ingreso contable, y el efectivo que todavía tenga el mes siguiente cuenta como ahorros.`;
  if (t.note === "household_loan")
    return `El hogar le presta su vivienda con un préstamo que debe devolver, así que lo que pide prestado cuenta como lo que paga de su parte de los gastos. Su cheque de ${mes} sería de ${usd(r.checkAfter)}.`;
  if (t.note === "loan" && t.kind === "excluded") return `La comida u otras cosas que le prestan, para devolver, no son ingreso. ${stays}`;
  if (t.kind === "unearned_cash") return `El efectivo cuenta como ingreso. Su cheque de ${mes} sería de ${usd(r.checkAfter)}.`;
  if (t.kind === "unearned_in_kind") return `Las entradas que recibe cuentan como ingreso por su valor. Su cheque de ${mes} sería de ${usd(r.checkAfter)}.`;
  if (t.kind === "ism_shelter")
    return r.trace.vtrApplied
      ? `Con la reducción de un tercio, la ayuda con ${label} no agrega nada más: ninguna otra ayuda para vivienda cuenta además de ella. Su cheque de ${mes} sería de ${usd(r.checkAfter)}.`
      : t.note === "loan"
        ? `La vivienda pagada como un préstamo que debe devolver cuenta solo por la parte que no tiene que devolver. Su cheque de ${mes} sería de ${usd(r.checkAfter)}.`
        : `La ayuda con ${label} cuenta como apoyo para vivienda, hasta ${usd(pmv(couple, r.trace.paymentMonth))} al mes. Su cheque de ${mes} sería de ${usd(r.checkAfter)}.`;
  if (t.ruleIds.includes("R-EDU-01")) return `Un regalo para matrícula, libros o útiles escolares no se cuenta. ${stays} Guarde los recibos.`;
  const after = r.resourcesAfter;
  if (t.ruleIds.includes("R-ABLE-01") && after.ableExcess > r.resourcesBefore.ableExcess)
    return (
      `Un regalo a su cuenta ABLE no se cuenta como ingreso, pero solo los primeros $100,000 de la cuenta quedan fuera de sus ahorros. ` +
      `Este regalo la lleva a ${usd(after.ableBalance)}, así que ${usd(after.ableExcess)} cuentan como ahorros, ${usd(after.countable)} en total el ${firstEs(after.on)}. ` +
      (!after.over ? `Eso está dentro del límite de ${usd(after.limit)}. ${stays}` : r.resourcesBefore.over ? "" : `${overLimitEs(after)}: su cheque de ${mes} sería de $0.`)
    );
  if (t.ruleIds.includes("R-ABLE-01"))
    return `Un regalo a su cuenta ABLE no se cuenta, y los primeros $100,000 en ella no cuentan como ahorros. ${stays}${t.ambiguous ? ` Esto pasaría el límite anual de ${usd(P.ableAnnualLimit)} para aportes a ABLE.` : ""}`;
  if (t.ruleIds.includes("R-FOOD-01")) return `La comida que pagan otras personas no se cuenta desde el 30 de septiembre de 2024. ${stays}`;
  if (t.ruleIds.includes("R-ITEM-01")) return `Un regalo del artículo mismo no se cuenta como ingreso. ${stays}`;
  return `Se paga directamente a la tienda, así que no se cuenta. ${stays}`;
}

