import sources from "../../../content/sources.json";
import type { Lang } from "@/lib/i18n/gift";

const SRC = sources as Record<string, { title: string; url: string; publisher?: string }>;
const UGIFT = SRC["ugift-iable"];
const ABLE_UNITED = SRC["able-united-gifting"];

/** The sample Ugift code the IAble page describes: six characters shown in two groups. Not a real account. */
const SAMPLE_CODE = "1A2-B3C";

type Text = { title: string; lede: (name: string, poss: string) => string; steps: (name: string, poss: string) => { k: string; v: string }[]; label: string; source: string; source2: string };
const TEXT: Record<Lang, Text> = {
  en: {
    title: "The ABLE share, for real",
    lede: (name: string, poss: string) =>
      `PayPal settles the shops and clinics. The ABLE share goes through ${poss} ABLE plan's own gift page and is not settled by PayPal: ABLE plans take gifts through their own pages, so Giftwise hands the giver to the plan for that part. In this sandbox a PayPal test account stands in for ${name}'s plan. What the giver sees, step by step:`,
    steps: (name: string, poss: string) => [
      { k: "Giftwise works out the split.", v: `The rules engine sends what counts as housing to ${poss} ABLE account and everything else to the shop, the same way it does here.` },
      { k: `${name}'s organizer shares ${poss} plan's gift code or link.`, v: `A Ugift plan gives each account a six-character code, shown like ${SAMPLE_CODE}; plans such as ABLE United give each account its own gifting link.` },
      { k: "The giver opens the plan's gift page.", v: `With a Ugift code, the giver types it at UgiftABLE.com and the plan opens ${name}'s own gifting page; with a gifting link, the link opens it. The gift is paid there, by bank transfer or check, into ${poss} ABLE account.` },
      { k: "The receipt names both.", v: `The shops' lines carry PayPal capture ids; the ABLE line names the plan's page. ${name}'s check stays whole either way, and the ABLE deposit counts toward the plan's yearly limit, which Giftwise tracks across every giver.` },
    ],
    label: "The real-world path, shown as a sample; in this sandbox the ABLE share is a PayPal sandbox capture.",
    source: "How a Ugift code works (IAble)",
    source2: "Gifting links (ABLE United)",
  },
  es: {
    title: "La parte de ABLE, en la vida real",
    lede: (name) =>
      `PayPal liquida las tiendas y clínicas. La parte de ABLE va por la página de regalos del propio plan ABLE y PayPal no la liquida: los planes ABLE reciben regalos por sus propias páginas, así que Giftwise lleva a quien regala al plan para esa parte. En este sandbox, una cuenta de prueba de PayPal hace las veces del plan de ${name}. Lo que ve quien regala, paso a paso:`,
    steps: (name) => [
      { k: "Giftwise calcula el reparto.", v: "El motor de reglas envía lo que cuenta como vivienda a la cuenta ABLE y el resto a la tienda, igual que aquí." },
      { k: `Quien organiza la página de ${name} comparte el código o el enlace de regalos del plan.`, v: `Un plan Ugift da a cada cuenta un código de seis caracteres, como ${SAMPLE_CODE}; planes como ABLE United dan a cada cuenta su propio enlace de regalos.` },
      { k: "Quien regala abre la página de regalos del plan.", v: `Con un código Ugift, lo escribe en UgiftABLE.com y el plan abre la página de regalos de ${name}; con un enlace, el enlace la abre. El regalo se paga allí, por transferencia bancaria o cheque, a la cuenta ABLE.` },
      { k: "El recibo nombra las dos cosas.", v: `Las líneas de las tiendas llevan los cobros de PayPal; la línea de ABLE nombra la página del plan. El cheque de ${name} no cambia, y el depósito en ABLE cuenta para el límite anual del plan, que Giftwise sigue entre todos los que regalan.` },
    ],
    label: "El camino real, mostrado como ejemplo; en este sandbox la parte de ABLE es un cobro del sandbox de PayPal.",
    source: "Cómo funciona un código Ugift (IAble, en inglés)",
    source2: "Enlaces de regalos (ABLE United, en inglés)",
  },
};

/**
 * What happens to the ABLE share of a gift outside the sandbox, as a labelled sample of the steps the giver sees, on the
 * gift page and on every receipt with an ABLE line. The facts come from the plans' own pages in content/sources.json.
 */
export function AbleHandoff({ name, poss, lang = "en", headingId = "able-real-h" }: { name: string; poss: string; lang?: Lang; headingId?: string }) {
  const t = TEXT[lang];
  const steps = t.steps(name, poss);
  return (
    <section className="ah" aria-labelledby={headingId} data-ui>
      <h2 id={headingId} className="ah-h">
        {t.title}
      </h2>
      <p className="ah-lede">{t.lede(name, poss)}</p>
      <ol className="ah-steps">
        {steps.map((s) => (
          <li key={s.k}>
            <p className="ah-k">{s.k}</p>
            <p className="ah-v">{s.v}</p>
          </li>
        ))}
      </ol>
      <p className="ah-label muted">
        {t.label}{" "}
        <a className="text-link" href={UGIFT.url} target="_blank" rel="noreferrer">
          {t.source}
        </a>
        {ABLE_UNITED && (
          <>
            {lang === "es" ? " y " : " and "}
            <a className="text-link" href={ABLE_UNITED.url} target="_blank" rel="noreferrer">
              {t.source2}
            </a>
          </>
        )}
      </p>
    </section>
  );
}
