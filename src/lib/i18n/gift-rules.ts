/** The rule sentence on a need, in Spanish (server side: it reads the Easy Read module's category words). */
import type { GiftResult } from "../rules";
import { P, pmv, usd, vtr } from "../rules";
import { CATEGORY_ES } from "../report/easy";
import { monthIn } from "./gift";

/** Follows the same branches as the engine's explanation. */
export function ruleSentenceEs(r: GiftResult, couple = false) {
  const t = r.treatment;
  const mes = monthIn("es", r.trace.paymentMonth);
  const label = CATEGORY_ES[r.gift.category];
  const stays = `Su cheque de ${mes} se mantiene en ${usd(r.checkAfter)}.`;
  if (t.kind === "not_possible")
    return t.note === "not_able_eligible"
      ? "Una cuenta ABLE es para personas cuya discapacidad empezó antes de los 46 años. Otra forma de dar funciona mejor aquí."
      : "La vivienda se paga como una factura, no se regala como un artículo. Puede pagar la factura a través de su cuenta ABLE.";
  if (t.kind === "unearned_cash") return `El efectivo cuenta como ingreso. Su cheque de ${mes} sería de ${usd(r.checkAfter)}.`;
  if (t.kind === "unearned_in_kind") return `Las entradas que recibe cuentan como ingreso por su valor. Su cheque de ${mes} sería de ${usd(r.checkAfter)}.`;
  if (t.kind === "ism_shelter")
    return r.trace.vtrApplied
      ? `Como vive en la casa de otra persona, la ayuda con ${label} baja su cheque de ${mes} en una cantidad fija de ${usd(vtr(couple, r.trace.paymentMonth))}, a ${usd(r.checkAfter)}.`
      : `La ayuda con ${label} cuenta como apoyo para vivienda, hasta ${usd(pmv(couple, r.trace.paymentMonth))} al mes. Su cheque de ${mes} sería de ${usd(r.checkAfter)}.`;
  if (t.ruleIds.includes("R-EDU-01")) return `Un regalo para matrícula, libros o útiles escolares no se cuenta. ${stays} Guarde los recibos.`;
  if (t.ruleIds.includes("R-ABLE-01"))
    return `Un regalo a su cuenta ABLE no se cuenta, y los primeros $100,000 en ella no cuentan como ahorros. ${stays}${t.ambiguous ? ` Esto pasaría el límite anual de ${usd(P.ableAnnualLimit)} para aportes a ABLE.` : ""}`;
  if (t.ruleIds.includes("R-FOOD-01")) return `La comida que pagan otras personas no se cuenta desde el 30 de septiembre de 2024. ${stays}`;
  if (t.ruleIds.includes("R-ITEM-01")) return `Un regalo del artículo mismo no se cuenta como ingreso. ${stays}`;
  return `Se paga directamente a la tienda, así que no se cuenta. ${stays}`;
}

