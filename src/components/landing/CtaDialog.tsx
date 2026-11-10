"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SituationForm, type SituationValue } from "../situation/SituationForm";
import { saveStartDraft } from "../situation/draft";
import { pronounWords, type Pronoun } from "@/lib/rules";
import { anyAnswer } from "@/lib/situation";
import { today } from "@/lib/time";

const PRONOUNS: { value: Pronoun; label: string }[] = [
  { value: "she", label: "she/her" },
  { value: "he", label: "he/him" },
  { value: "they", label: "they/them" },
];

/**
 * "First step, already open": the gift page's first question at true size. The name carries over to the page it makes.
 * `heading` is the card's own title; /start passes null because its page title already says it.
 *
 * With `situation` (on /start), a second step asks the person's situation in plain questions, or reads their letter
 * from Social Security, so the new page runs on their own facts. Every question is optional; skipping keeps the
 * sample situation, which the page then names. The answers travel to the page-making form in this tab only.
 */
export function CtaDialog({ heading = "Start a gift page", situation = false }: { heading?: string | null; situation?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("Maya");
  const [pronoun, setPronoun] = useState<Pronoun>("she");
  const [step, setStep] = useState<1 | 2>(1);
  const [value, setValue] = useState<SituationValue>({ answers: {}, source: "answers" });
  const first = name.trim() || "Maya";
  const w = pronounWords(pronoun);
  const go = (keep: boolean) => {
    saveStartDraft(keep && anyAnswer(value.answers) ? { name: first, pronoun, answers: value.answers, source: value.source } : { name: first, pronoun, answers: {}, source: "answers" });
    router.push(`/try?name=${encodeURIComponent(first)}#fundraiser`);
  };

  if (situation && step === 2) {
    return (
      <form
        className="cta-dialog cta-situation"
        data-ui
        aria-labelledby="cta-sit-h"
        onSubmit={(e) => {
          e.preventDefault();
          go(true);
        }}
      >
        <div className="cta-step-head">
          <h2 id="cta-sit-h" className="cta-dialog-title">
            {first}&rsquo;s situation
          </h2>
          <button type="button" className="sit-link cta-back" onClick={() => setStep(1)}>
            Back
          </button>
        </div>
        <p className="sit-lede">
          {w.Poss} check depends on where {w.subj} {w.lives} and on any other income. Answer what you know, or skip: the page then uses a sample situation until you add {w.hers}.
        </p>
        <SituationForm
          name={first}
          pronoun={pronoun}
          today={today()}
          value={value}
          onChange={setValue}
          onSample={() => {
            // The sample letter is Sam's: a page started from it is his, unless a name was typed.
            if (name.trim() === "Maya" || !name.trim()) {
              setName("Sam");
              setPronoun("he");
            }
          }}
        />
        <button type="submit" className="btn btn-primary cta-submit">
          Next: add the needs
        </button>
        <button type="button" className="sit-link cta-skip" onClick={() => go(false)}>
          Skip, use a sample situation for now
        </button>
      </form>
    );
  }

  return (
    <form
      className="cta-dialog"
      data-ui
      onSubmit={(e) => {
        e.preventDefault();
        if (situation) setStep(2);
        else router.push(`/try?name=${encodeURIComponent(first)}#fundraiser`);
      }}
    >
      {heading && <h3 className="cta-dialog-title">{heading}</h3>}
      <label className="cta-field">
        <span>Who is it for? Their first name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" maxLength={40} />
      </label>
      {situation && (
        <fieldset className="cta-field">
          <legend>How the page refers to them</legend>
          <div className="checker-seg cta-pronouns">
            {PRONOUNS.map((p) => (
              <label key={p.value} className="checker-seg-opt" data-on={pronoun === p.value ? "" : undefined}>
                <input type="radio" name="cta-pronoun" value={p.value} checked={pronoun === p.value} onChange={() => setPronoun(p.value)} />
                {p.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <button type="submit" className="btn btn-primary cta-submit">
        {situation ? `Next: ${first}'s situation` : "Next: add the needs"}
      </button>
      <p className="cta-fine">
        {situation ? "Then paste a fundraiser's link or use the sample. No sign-up. Runs in the PayPal sandbox." : "Paste a fundraiser’s link or use the sample. No sign-up. Runs in the PayPal sandbox."}
      </p>
    </form>
  );
}
