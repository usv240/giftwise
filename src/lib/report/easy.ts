import { addMonths, monthName, monthOf, usd, type Category } from "@/lib/rules";
import type { ReportLine, SsaReport } from "./ssa";

/**
 * The month's report for the person themselves, in Easy Read, in English or Spanish.
 *
 * Written to the Easy Read guides of NHS England (2018), Inclusion Europe ("Information for all") and the Autistic Self
 * Advocacy Network ("One Idea Per Line", 2021): one idea per line, about 15 words a sentence, each new sentence on a new
 * line, a matching picture on the left of each idea, key words explained, numerals, the same word for the same thing,
 * and no colons, semicolons or brackets. Every sentence comes from the same deterministic report as the full version
 * (buildReport), so the numbers cannot drift, and unit tests hold every sentence to these rules in both languages.
 * No model writes or translates any of it.
 */

export type EasyLang = "en" | "es";
export type Picture = "ok" | "phone" | "check" | "shop" | "able" | "cash" | "calendar" | "paper" | "savings" | "clock" | "help" | "id";
export type EasyLine = { picture?: Picture; text: string; note?: string };
export type EasySection = { id: string; title: string; lines: EasyLine[] };
export type EasyRead = {
  lang: EasyLang;
  title: string;
  label: string;
  month: string;
  /** In the cash view: the lines that say this is a what-if, not the real report. */
  whatIf?: EasyLine[];
  answer: EasyLine[];
  sections: EasySection[];
  script: string[];
  footer: string[];
  /** Words for the page's own controls, so the whole page reads in one language. */
  ui: Record<"full" | "other" | "remind" | "print" | "say" | "copy" | "copied" | "failed" | "back" | "nav" | "heading" | "lede" | "answerLabel" | "listen" | "stop", string>;
};

const LOCALE: Record<EasyLang, string> = { en: "en-US", es: "es-US" };
const dateIn = (lang: EasyLang, iso: string) =>
  new Intl.DateTimeFormat(LOCALE[lang], { month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
const monthIn = (lang: EasyLang, month: string) => (lang === "en" ? monthName(month) : new Intl.DateTimeFormat("es-US", { month: "long", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`)));
const monthYearIn = (lang: EasyLang, month: string) => `${monthIn(lang, month)}${lang === "es" ? " de " : " "}${month.slice(0, 4)}`;
const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

export const CATEGORY_ES: Record<Category, string> = {
  medical: "atención médica",
  equipment: "equipo",
  phone: "la factura del teléfono",
  internet: "la factura de internet",
  education: "gastos de estudio",
  utility: "la factura de servicios",
  rent: "el alquiler",
  mortgage: "la hipoteca",
  property_tax: "el impuesto de la casa",
  food: "comida",
  clothing: "ropa",
  transport: "transporte",
  personal: "cosas personales",
  event: "entradas a un evento",
  other: "sus ahorros",
};

/** What a gift paid for, as its own short sentence under the gift: "It is for the phone bill." */
function forNote(lang: EasyLang, l: ReportLine): string | undefined {
  if (lang === "es") return `Es para ${CATEGORY_ES[l.category]}.`;
  const what = l.need.replace(/,.*$/, "").trim();
  if (!what || /\bable\b/i.test(what)) return undefined;
  return `It is for the ${lowerFirst(what)}.`;
}

/** One gift, as one short sentence about where the money went, and what it was for. */
function giftSentence(lang: EasyLang, l: ReportLine, name: string): EasyLine {
  const amount = usd(l.amount);
  const when = dateIn(lang, l.date);
  if (lang === "en") {
    if (l.delivery === "cash") return { picture: "cash", text: `On ${when}, ${l.giver} gave you ${amount} in cash.` };
    if (l.delivery === "able") return { picture: "able", text: `On ${when}, ${l.giver} put ${amount} in your ABLE account.`, note: forNote(lang, l) };
    if (l.delivery === "item") return { picture: "shop", text: `On ${when}, ${l.giver} gave you ${lowerFirst(l.need)}, worth ${amount}.` };
    return { picture: "shop", text: `On ${when}, ${l.giver} paid ${l.paidTo === name ? "you" : l.paidTo} ${amount}.`, note: forNote(lang, l) };
  }
  if (l.delivery === "cash") return { picture: "cash", text: `El ${when}, ${l.giver} le dio ${amount} en efectivo.` };
  if (l.delivery === "able") return { picture: "able", text: `El ${when}, ${l.giver} puso ${amount} en su cuenta ABLE.`, note: forNote(lang, l) };
  if (l.delivery === "item") return { picture: "shop", text: `El ${when}, ${l.giver} le regaló ${CATEGORY_ES[l.category]}, con valor de ${amount}.` };
  return { picture: "shop", text: `El ${when}, ${l.giver} le pagó ${amount} a ${l.paidTo}.`, note: forNote(lang, l) };
}

/** The first time the page says "ABLE account", the next line says what one is. */
function explainAble(lang: EasyLang, groups: EasyLine[][]) {
  for (const lines of groups) {
    const at = lines.findIndex((l) => /\bABLE\b/.test(l.text));
    if (at === -1) continue;
    lines.splice(at + 1, 0, { text: lang === "en" ? "An ABLE account is a savings account for people with disabilities." : "Una cuenta ABLE es una cuenta de ahorros para personas con discapacidad." });
    return;
  }
}

export function easyRead(r: SsaReport, lang: EasyLang): EasyRead {
  const en = lang === "en";
  const m = monthIn(lang, r.month);
  // The check is named with its year: the full amount is $994 in 2026 and $1,029 from January 2027.
  const checkM = monthYearIn(lang, r.totals.checkMonth);
  const due = dateIn(lang, r.due.date);
  const tell = r.lines.filter((l) => l.section === "tell");
  const records = r.lines.filter((l) => l.section === "records");
  const less = Math.round((r.totals.fullCheck - r.totals.check) * 100) / 100;

  const answer: EasyLine[] = [];
  if (r.status === "no_gifts") {
    answer.push({ picture: "ok", text: en ? `Giftwise has no gifts for you in ${m}.` : `Giftwise no tiene regalos para usted en ${m}.` });
    answer.push({ picture: "check", text: en ? `Your SSI check in ${checkM} stays ${usd(r.totals.check)}.` : `Su cheque de SSI de ${checkM} sigue siendo ${usd(r.totals.check)}.` });
  } else if (r.status === "nothing_counts") {
    answer.push({ picture: "ok", text: en ? "You do not need to call Social Security about these gifts." : "No tiene que llamar al Seguro Social por estos regalos." });
    answer.push({ picture: "check", text: en ? `Your SSI check in ${checkM} stays ${usd(r.totals.check)}.` : `Su cheque de SSI de ${checkM} sigue siendo ${usd(r.totals.check)}.` });
  } else {
    answer.push({ picture: "phone", text: en ? `Call Social Security by ${due}.` : `Llame al Seguro Social a más tardar el ${due}.` });
    answer.push({
      picture: "paper",
      text: en ? `Tell them about ${tell.length === 1 ? "1 gift" : `${tell.length} gifts`}.` : `Hábleles de ${tell.length === 1 ? "1 regalo" : `${tell.length} regalos`}.`,
    });
    answer.push({ picture: "check", text: en ? `Your SSI check in ${checkM} will be ${usd(r.totals.check)}.` : `Su cheque de SSI de ${checkM} será de ${usd(r.totals.check)}.` });
    if (less > 0) answer.push({ text: en ? `That is ${usd(less)} less than usual.` : `Son ${usd(less)} menos de lo normal.` });
  }

  const sections: EasySection[] = [];
  if (records.length) {
    sections.push({
      id: "records",
      title: en ? "Gifts that do not count" : "Regalos que no cuentan",
      lines: [
        ...records.map((l) => giftSentence(lang, l, r.name)),
        { picture: "shop", text: en ? "This money went to a shop or your ABLE account." : "Este dinero fue a una tienda o a su cuenta ABLE." },
        { text: en ? "It did not go to you, so it is not income." : "No le llegó a usted, así que no es ingreso." },
        { picture: "ok", text: en ? "You do not need to report these gifts." : "No tiene que reportar estos regalos." },
      ],
    });
  }
  if (tell.length) {
    sections.push({
      id: "tell",
      title: en ? "Gifts to tell Social Security about" : "Regalos que debe reportar",
      lines: [
        ...tell.map((l) => giftSentence(lang, l, r.name)),
        { picture: "paper", text: en ? "These gifts count as income." : "Estos regalos cuentan como ingreso." },
        { text: en ? `Income can make your SSI check smaller.` : "El ingreso puede bajar su cheque de SSI." },
      ],
    });
  }

  const todo: EasyLine[] = [];
  const housingToAble = r.lines.find((l) => l.delivery === "able" && l.ruleIds.includes("R-ABLE-02"));
  if (housingToAble) {
    const inProgress = r.due.state === "in_progress";
    todo.push(
      en
        ? { picture: "able", text: inProgress ? `Pay the ${lowerFirst(housingToAble.need)} from your ABLE account in ${m}.` : `Check that you paid the ${lowerFirst(housingToAble.need)} from your ABLE account in ${m}.` }
        : { picture: "able", text: inProgress ? `Pague ${CATEGORY_ES[housingToAble.category]} con su cuenta ABLE en ${m}.` : `Revise que pagó ${CATEGORY_ES[housingToAble.category]} con su cuenta ABLE en ${m}.` },
      { text: en ? "Money not spent by the 1st of next month counts as savings." : "El dinero que no gaste antes del día 1 del mes siguiente cuenta como ahorros." },
    );
  }
  if (r.savings) {
    const next = monthOf(r.savings.onDate);
    const first = en ? `${monthName(next)} 1` : `1 de ${monthIn(lang, next)}`;
    const limit = usd(r.savings.limit);
    const amount = usd(r.savings.amount);
    if (r.savings.over) {
      todo.push(
        { picture: "savings", text: en ? `On ${first}, your savings would be ${amount}.` : `El ${first}, sus ahorros serían ${amount}.` },
        { text: en ? `That is over the ${limit} limit.` : `Eso pasa el límite de ${limit}.` },
        { picture: "able", text: en ? `Before ${first}, spend some or move it to your ABLE account.` : `Antes del ${first}, gaste algo o páselo a su cuenta ABLE.` },
      );
    } else {
      todo.push(
        { picture: "savings", text: en ? `On ${first}, your savings will be ${amount}.` : `El ${first}, sus ahorros serán ${amount}.` },
        { text: en ? `That is under the ${limit} limit.` : `Eso está debajo del límite de ${limit}.` },
      );
    }
  }
  if (records.length) todo.push({ picture: "paper", text: en ? "Keep this page." : "Guarde esta hoja." }, { text: en ? "It shows where each gift went." : "Muestra a dónde fue cada regalo." });
  if (todo.length) sections.push({ id: "todo", title: en ? "Things to do" : "Qué hacer", lines: todo });

  sections.push({
    id: "call",
    title: tell.length ? (en ? "How to call" : "Cómo llamar") : en ? "If you need to call" : "Si necesita llamar",
    lines: [
      { picture: "phone", text: en ? `Call Social Security at ${r.how.phone}.` : `Llame al Seguro Social al ${r.how.phone}.` },
      { text: en ? "For Spanish, press 7." : "Para español, oprima 7." },
      { text: en ? `If you use TTY, call ${r.how.tty}.` : `Si usa TTY, llame al ${r.how.tty}.` },
      { picture: "id", text: en ? "Have your Social Security number ready." : "Tenga a mano su número de Seguro Social." },
      { text: en ? "Giftwise will never ask for it." : "Giftwise nunca se lo va a pedir." },
      ...(tell.length
        ? [
            { picture: "clock" as const, text: en ? `If you call after ${due}, your report is late.` : `Si llama después del ${due}, su reporte llega tarde.` },
            { text: en ? `A late report can cost you ${usd(r.penalty.amounts[0])}.` : `Un reporte tarde le puede costar ${usd(r.penalty.amounts[0])}.` },
          ]
        : []),
    ],
  });

  const whatIf: EasyLine[] | undefined =
    r.view === "cash"
      ? [
          { picture: "cash", text: en ? "What if every gift had been cash?" : "¿Y si cada regalo hubiera sido en efectivo?" },
          { text: en ? "This page shows that report." : "Esta hoja muestra ese reporte." },
        ]
      : undefined;
  explainAble(lang, [...(whatIf ? [whatIf] : []), answer, ...sections.map((s) => s.lines)]);

  const script = tell.length
    ? [
        en ? `Hello. My name is ${r.name}.` : `Hola. Me llamo ${r.name}.`,
        en ? `I am calling to report gifts for ${monthYearIn(lang, r.month)}.` : `Llamo para reportar regalos de ${monthYearIn(lang, r.month)}.`,
        ...tell.map((l) => {
          const when = dateIn(lang, l.date);
          if (l.delivery === "cash") return en ? `On ${when}, ${l.giver} gave me ${usd(l.amount)} in cash.` : `El ${when}, ${l.giver} me dio ${usd(l.amount)} en efectivo.`;
          if (l.kind === "ism_shelter") return en ? `On ${when}, ${l.giver} paid ${usd(l.amount)} of my ${lowerFirst(l.need)}.` : `El ${when}, ${l.giver} pagó ${usd(l.amount)} de ${CATEGORY_ES[l.category]}.`;
          return en ? `On ${when}, ${l.giver} gave me something worth ${usd(l.amount)}.` : `El ${when}, ${l.giver} me dio algo con valor de ${usd(l.amount)}.`;
        }),
        en ? "That is all. I have the receipts." : "Eso es todo. Tengo los recibos.",
      ]
    : [];

  return {
    lang,
    title: en ? `Your gifts in ${monthYearIn(lang, r.month)}` : `Sus regalos de ${monthYearIn(lang, r.month)}`,
    label: en ? "Easy Read" : "Lectura fácil",
    month: r.month,
    whatIf,
    answer,
    sections,
    script,
    footer: en
      ? ["Giftwise wrote this from the gifts made through it.", "It is about gifts only.", "It is not legal advice.", "Giftwise never talks to Social Security for you."]
      : ["Giftwise escribió esto con los regalos hechos por Giftwise.", "Solo habla de regalos.", "No es consejo legal.", "Giftwise nunca habla con el Seguro Social por usted."],
    ui: en
      ? { full: "The full report", other: "En español", remind: "Remind me by the 10th", print: "Print", say: "What to say on the call", copy: "Copy what to say", copied: "Copied", failed: "Select the words to copy them", back: "Back to the gift page", nav: "Report options", heading: "Easy Read report", lede: "This page is about your gifts. One idea on each line, with a picture.", answerLabel: "The answer", listen: "Listen", stop: "Stop" }
      : { full: "El reporte completo, en inglés", other: "In English", remind: "Recordarme antes del día 10", print: "Imprimir", say: "Qué decir en la llamada", copy: "Copiar qué decir", copied: "Copiado", failed: "Seleccione el texto para copiarlo", back: "Volver a la página de regalos", nav: "Opciones del reporte", heading: "Reporte en lectura fácil", lede: "Esta página habla de sus regalos. Una idea en cada línea, con un dibujo.", answerLabel: "La respuesta", listen: "Escuchar", stop: "Parar" },
  };
}

/** Every line a reader sees on the sheet, notes included, in reading order. */
export function easyLines(e: EasyRead): string[] {
  return [...(e.whatIf ?? []), ...e.answer, ...e.sections.flatMap((s) => s.lines)].flatMap((l) => (l.note ? [l.text, l.note] : [l.text])).concat(e.script).concat(e.footer);
}

/** Every sentence a reader sees, for the word-count test. */
export function easySentences(e: EasyRead): string[] {
  return easyLines(e).flatMap((t) => t.split(/(?<=[.?!])\s+/));
}

const ics = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
const stamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d+/, "");

/**
 * A calendar file with two reminders: this month's report on its due date, with an alert three days before, and a
 * monthly look at the report on the 5th, so each month's gifts are checked before the 10th (20 CFR 416.714(a)).
 */
export function reminderIcs(r: SsaReport, lang: EasyLang, pageUrl: string, now = new Date().toISOString()): string {
  const en = lang === "en";
  const m = monthIn(lang, r.month);
  const dueDay = r.due.date.replace(/-/g, "");
  const next = `${addMonths(monthOf(r.due.date), 1)}-05`.replace(/-/g, "");
  const tellCount = r.lines.filter((l) => l.section === "tell").length;
  const dueTitle = tellCount
    ? en
      ? `Call Social Security about ${m} gifts`
      : `Llamar al Seguro Social por los regalos de ${m}`
    : en
      ? `Report day for ${m}: nothing from Giftwise to report`
      : `Día de reporte de ${m}: nada que reportar de Giftwise`;
  const dueText = en
    ? `Reports are due by the 10th. Call ${r.how.phone}. Your report: ${pageUrl}`
    : `El reporte vence el día 10. Llame al ${r.how.phone} y oprima 7. Su reporte: ${pageUrl}`;
  const monthlyTitle = en ? "Look at this month's Giftwise report" : "Revisar el reporte de Giftwise de este mes";
  const monthlyText = en ? `Gifts are reported by the 10th of the next month. ${pageUrl}` : `Los regalos se reportan antes del día 10 del mes siguiente. ${pageUrl}`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Giftwise//SSI report reminder//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:giftwise-due-${r.month}@giftwise`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART;VALUE=DATE:${dueDay}`,
    `SUMMARY:${ics(dueTitle)}`,
    `DESCRIPTION:${ics(dueText)}`,
    `URL:${pageUrl}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${ics(dueTitle)}`,
    "TRIGGER:-P3D",
    "END:VALARM",
    "END:VEVENT",
    "BEGIN:VEVENT",
    `UID:giftwise-monthly@giftwise`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART;VALUE=DATE:${next}`,
    "RRULE:FREQ=MONTHLY;BYMONTHDAY=5;COUNT=12",
    `SUMMARY:${ics(monthlyTitle)}`,
    `DESCRIPTION:${ics(monthlyText)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
