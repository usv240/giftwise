"use client";

import { useId, useState } from "react";
import { Info } from "../Info";
import { parseDollars } from "@/lib/parseDollars";
import { pronounWords, usd, type Pronoun } from "@/lib/rules";
import { anyAnswer, checkToday, homeLine, answersToProfile, letterCheck, type Answers } from "@/lib/situation";
import { modelName } from "@/lib/ai/model-name";
import type { LetterReading } from "@/lib/ai/letter";
import "./situation.css";

/**
 * The person's situation in plain questions, every one optional, with a shortcut: read her letter from Social Security
 * into the same answers. The rules engine runs here as the answers change, so the organizer sees the check they give;
 * the server runs the same engine on the same facts once they are saved. Used at page setup (/start) and on the
 * organizer's private page.
 */
export type SituationValue = { answers: Answers; source: "answers" | "letter" };

type Reading = { letter: LetterReading; quotes: { checked: number; found: number; set_aside: number; text_layer: boolean }; replayed: boolean; recordedAt?: string; model?: string; sample: boolean };

export const SAMPLE_LETTER_URL = "/samples/sam-ssa-letter-sample.pdf";
const SAMPLE_LETTER_PNG = "/samples/sam-ssa-letter-sample.png";

export function SituationForm({
  name,
  pronoun,
  today,
  value,
  onChange,
  onSample,
}: {
  name: string;
  pronoun: Pronoun;
  today: string;
  value: SituationValue;
  onChange: (v: SituationValue) => void;
  /** Called when the sample letter (Sam's, made up for the demo) fills the answers. */
  onSample?: () => void;
}) {
  const uid = useId();
  const w = pronounWords(pronoun);
  const who = name.trim() || w.subj;
  const a = value.answers;
  // Filling from a letter starts the amount fields again from the answers it gave.
  const [filled, setFilled] = useState(0);
  const set = (patch: Partial<Answers>) => onChange({ answers: { ...a, ...patch }, source: value.source });
  const now = checkToday(a, today, pronoun);
  const home = homeLine(answersToProfile(a, pronoun).profile, today.slice(0, 7));
  // With a name the verbs are singular ("Where does Jordan live?"); with only a pronoun they follow it.
  const named = Boolean(name.trim());
  const does = named || w.subj !== "they" ? "does" : "do";
  const pays = named ? "pays" : w.pays;

  return (
    <div className="sit">
      <LetterReader
        who={who}
        pronoun={pronoun}
        answers={a}
        onRead={(read, sample) => {
          onChange({ answers: { ...a, ...read }, source: "letter" });
          setFilled((n) => n + 1);
          if (sample) onSample?.();
        }}
      />

      <fieldset className="sit-q sit-set">
        <legend className="sit-legend">
          Where {does} {who} live? <Info id="situation.home" label="" topic={`where ${who} lives`} />
        </legend>
        <div className="sit-choices">
          {(
            [
              ["own", `On ${w.poss} own, or ${w.subj} ${w.pays} ${w.poss} share of the costs where ${w.subj} ${w.lives}`],
              ["other", `In someone else's home, such as a parent's`],
            ] as const
          ).map(([v, label]) => (
            <label key={v} className="sit-choice" data-on={a.home === v ? "" : undefined}>
              <input type="radio" name={`${uid}-home`} value={v} checked={a.home === v} onChange={() => set({ home: v })} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {a.home === "other" && (
          <div className="sit-follow">
            <YesNo
              label={`Does that household give ${w.obj} all ${w.poss} meals?`}
              name={`${uid}-meals`}
              value={a.meals}
              onChange={(v) => set({ meals: v })}
            />
            <div className="sit-q-head sit-follow-k">
              <span>{w.Poss} share of the home&rsquo;s costs (optional)</span>
              <Info id="situation.share" label="" topic={`${who}'s share of the home's costs`} />
            </div>
            <div className="sit-grid">
              <Count key={`size-${filled}`} id={`${uid}-size`} label="People living there" hint={`${who} included`} value={a.householdSize} onValue={(v) => set({ householdSize: v })} />
              <Money key={`costs-${filled}`} id={`${uid}-costs`} label="The home's monthly costs" hint="Rent or mortgage, property tax, utilities. Not food." value={a.householdCosts} onValue={(v) => set({ householdCosts: v })} />
              <Money key={`pays-${filled}`} id={`${uid}-pays`} label={`What ${who} ${pays} toward them`} hint="Each month" value={a.householdPays} onValue={(v) => set({ householdPays: v })} />
            </div>
          </div>
        )}
      </fieldset>

      <div className="sit-grid">
        <Money
          key={`benefits-${filled}`}
          id={`${uid}-benefits`}
          label="Social Security or other benefits"
          hint="Each month: SSDI, retirement or survivor benefits, a pension"
          info="situation.benefits"
          value={a.benefits}
          onValue={(v) => set({ benefits: v })}
        />
        <Money key={`wages-${filled}`} id={`${uid}-wages`} label="Pay from work" hint="Each month, before taxes" info="situation.wages" value={a.wages} onValue={(v) => set({ wages: v })} />
        <Money key={`savings-${filled}`} id={`${uid}-savings`} label="Savings now" hint={`Bank and cash, not ${w.poss} ABLE account`} info="situation.savings" value={a.savings} onValue={(v) => set({ savings: v })} />
      </div>

      <div className="sit-grid sit-grid-two">
        <YesNo label="Married, and both receive SSI?" info="situation.couple" name={`${uid}-couple`} value={a.couple} onChange={(v) => set({ couple: v })} />
        <YesNo label={`Did ${w.poss} disability begin before age 46?`} info="situation.able" name={`${uid}-able`} value={a.ableEligible} onChange={(v) => set({ ableEligible: v })} />
      </div>

      {/* The engine's answer for these facts, as they change: the check for a gift made today, before any gift. */}
      <div className="sit-result" role="status" aria-live="polite">
        <p className="sit-result-k">
          {w.Poss} {now.label} check {anyAnswer(a) ? "with these answers" : "in the sample situation"}
        </p>
        <p className="sit-result-v tabular">{usd(now.check)}</p>
        {home && <p className="sit-result-note">{home}</p>}
        {!anyAnswer(a) && <p className="sit-result-note">No answers yet, so this is the sample situation: one adult on {w.poss} own, no other income. Every question is optional.</p>}
      </div>
    </div>
  );
}

/** Yes, no, or not answered yet: two radios with neither chosen at first. */
function YesNo({ label, name, value, onChange, info }: { label: string; name: string; value: boolean | undefined; onChange: (v: boolean) => void; info?: string }) {
  return (
    <fieldset className="sit-q sit-set">
      <legend className="sit-legend">
        {label} {info && <Info id={info} label="" topic={label.replace(/\?$/, "")} />}
      </legend>
      <div className="checker-seg sit-seg">
        {(
          [
            [true, "Yes"],
            [false, "No"],
          ] as const
        ).map(([v, l]) => (
          <label key={l} className="checker-seg-opt" data-on={value === v ? "" : undefined}>
            <input type="radio" name={name} checked={value === v} onChange={() => onChange(v)} />
            {l}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** A money answer, kept as typed: empty is unanswered, and text with no number in it says so. */
function Money({ id, label, hint, info, value, onValue }: { id: string; label: string; hint?: string; info?: string; value: number | undefined; onValue: (v: number | undefined) => void }) {
  const [raw, setRaw] = useState(value === undefined ? "" : String(value));
  const bad = raw.trim() !== "" && parseDollars(raw) === null;
  return (
    <div className="sit-q sit-field">
      <div className="sit-q-head">
        <label htmlFor={id}>{label}</label>
        {info && <Info id={info} label="" topic={label} />}
      </div>
      <span className="sit-money">
        <span aria-hidden="true">$</span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            const t = e.target.value.trim();
            onValue(t === "" ? undefined : (parseDollars(t) ?? undefined));
          }}
          aria-invalid={bad || undefined}
          aria-describedby={bad ? `${id}-note` : hint ? `${id}-hint` : undefined}
        />
      </span>
      {bad ? (
        <p id={`${id}-note`} className="sit-note" role="alert">
          Type dollars, like 600.
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="sit-hint">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** A whole number of people, from 1 to 20. */
function Count({ id, label, hint, value, onValue }: { id: string; label: string; hint?: string; value: number | undefined; onValue: (v: number | undefined) => void }) {
  const [raw, setRaw] = useState(value === undefined ? "" : String(value));
  const n = Number(raw.trim());
  const bad = raw.trim() !== "" && !(Number.isInteger(n) && n >= 1 && n <= 20);
  return (
    <div className="sit-q sit-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value);
          const m = Number(e.target.value.trim());
          onValue(e.target.value.trim() !== "" && Number.isInteger(m) && m >= 1 && m <= 20 ? m : undefined);
        }}
        aria-invalid={bad || undefined}
        aria-describedby={bad ? `${id}-note` : hint ? `${id}-hint` : undefined}
      />
      {bad ? (
        <p id={`${id}-note`} className="sit-note" role="alert">
          Type a whole number from 1 to 20.
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="sit-hint">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthLabel = (m: string | null) => (m && /^\d{4}-\d{2}$/.test(m) ? `${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}` : null);
const cents = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/**
 * "Read her letter from Social Security": a photo or PDF, or the sample letter. The facts read fill the answers; each
 * shows its quote, marked when the PDF's own text has it word for word, and the engine's check is compared with the
 * payment the letter states, live as the answers change.
 */
function LetterReader({ who, pronoun, answers, onRead }: { who: string; pronoun: Pronoun; answers: Answers; onRead: (a: Answers, sample: boolean) => void }) {
  const w = pronounWords(pronoun);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reading, setReading] = useState<Reading | null>(null);

  async function read(file: Blob, filename: string, sample: boolean) {
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file, filename);
      form.append("pronoun", pronoun);
      const r = await fetch("/api/v1/read-letter", { method: "POST", body: form });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error?.message ?? "The letter could not be read just now. The questions below work without it.");
      setReading({ letter: j.data.letter, quotes: j.data.quotes, replayed: Boolean(j.meta?.replayed), recordedAt: j.meta?.recorded_at, model: j.meta?.model, sample });
      onRead(j.data.answers as Answers, sample);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const l = reading?.letter;
  const cross = l ? letterCheck(answers, { amount: l.ssi_payment.amount, month: l.ssi_payment.month }, pronoun) : null;
  const facts = l ? letterFacts(l, w) : [];

  return (
    <section className="sit-letter" aria-label={`Read ${who}'s letter from Social Security`} data-ui>
      <div className="sit-q-head">
        <p className="sit-letter-title">Read {who}&rsquo;s letter from Social Security</p>
        <Info id="situation.letter" label="" topic={`reading ${who}'s letter`} />
      </div>
      <p className="sit-letter-text">Optional. A photo or PDF of the letter that states {w.poss} SSI payment fills in the answers below. You check them before anything is saved, and the file is not kept.</p>
      <div className="sit-letter-actions">
        <label className="btn btn-ink sit-file" aria-disabled={busy || undefined}>
          {busy ? "Reading the letter…" : "Choose a photo or PDF"}
          <input
            type="file"
            className="sr-only"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void read(f, f.name, false);
            }}
          />
        </label>
        <button
          type="button"
          className="btn btn-quiet"
          disabled={busy}
          onClick={async () => {
            const blob = await fetch(SAMPLE_LETTER_URL).then((r) => r.blob());
            void read(blob, "sam-ssa-letter-sample.pdf", true);
          }}
        >
          Use the sample letter
        </button>
        <a className="text-link sit-see" href={SAMPLE_LETTER_PNG} target="_blank" rel="noreferrer">
          See the sample
        </a>
      </div>
      {error && (
        <p className="sit-note" role="alert">
          {error}
        </p>
      )}
      {l && reading && cross && (
        <div className="sit-read" aria-live="polite">
          <p className="sit-read-k">{reading.sample ? "Read from the sample letter, made up for this demo" : "Read from the letter"}</p>
          {!l.is_ssa_letter && <p className="sit-note">This does not look like a letter about SSI payments, so check each answer below.</p>}
          <ul className="sit-read-list">
            {facts.map((f) => (
              <li key={f.k}>
                <p className="sit-read-fact">{f.fact}</p>
                {f.quote && <q className="sit-quote">{f.quote}</q>}
                {f.found !== null && (
                  <span className="sit-found" data-ok={f.found ? "" : undefined}>
                    {f.found ? "Found word for word in the letter's text" : "Not found in the letter's text, so check it"}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="sit-cross" data-match={cross.matches ? "" : undefined} data-differ={cross.matches === false ? "" : undefined}>
            {cross.plain}
          </p>
          <p className="sit-read-source">
            {reading.replayed
              ? `Replayed: ${modelName(reading.model)}'s recorded reading${reading.recordedAt ? ` of ${new Date(reading.recordedAt).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" })}` : ""}, run just now through the same checks.`
              : `Read just now by ${modelName(reading.model)}. Nothing from the file is kept.`}{" "}
            {reading.quotes.text_layer
              ? `${reading.quotes.found} of ${reading.quotes.checked} quotes found word for word in the letter's text.`
              : "A photo has no text layer, so the quotes are shown as read."}
            {reading.quotes.set_aside > 0 && ` ${reading.quotes.set_aside} quote${reading.quotes.set_aside === 1 ? " was" : "s were"} left out because ${reading.quotes.set_aside === 1 ? "it" : "they"} held private details.`}
          </p>
        </div>
      )}
    </section>
  );
}

/** The facts read, one line each, with the quote that states it. Facts the letter does not state are left out. */
function letterFacts(l: LetterReading, w: ReturnType<typeof pronounWords>) {
  const out: { k: string; fact: string; quote: string | null; found: boolean | null }[] = [];
  const m = monthLabel(l.ssi_payment.month);
  if (l.ssi_payment.amount !== null) out.push({ k: "pay", fact: `SSI payment: ${cents(l.ssi_payment.amount)} a month${m ? `, for ${m}` : ""}`, quote: l.ssi_payment.quote, found: l.ssi_payment.quote_found });
  l.other_income.forEach((x, i) => out.push({ k: `inc${i}`, fact: `${x.kind === "social_security" ? "Social Security" : "Other benefits"}: ${cents(x.monthly_amount)} a month`, quote: x.quote, found: x.quote_found }));
  if (l.wages.monthly_amount !== null) out.push({ k: "wages", fact: l.wages.monthly_amount > 0 ? `Wages: ${cents(l.wages.monthly_amount)} a month` : "No wages", quote: l.wages.quote, found: l.wages.quote_found });
  const la = l.living_arrangement;
  if (la.in_anothers_household !== null)
    out.push({
      k: "home",
      fact: la.in_anothers_household ? `Lives in another person's household${la.gets_all_meals === true ? ", which gives food and shelter" : la.gets_all_meals === false ? ", which gives shelter" : ""}` : `Lives in ${w.poss} own household`,
      quote: la.quote,
      found: la.quote_found,
    });
  if (l.couple.is_couple !== null) out.push({ k: "couple", fact: l.couple.is_couple ? "Paid as a couple" : "Paid as one person", quote: l.couple.quote, found: l.couple.quote_found });
  return out;
}
