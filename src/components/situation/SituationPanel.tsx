"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SituationForm, type SituationValue } from "./SituationForm";
import { pronounWords, type Pronoun } from "@/lib/rules";
import { anyAnswer, answersToProfile, type Answers } from "@/lib/situation";

/**
 * The person's situation on the organizer's private page: what the page uses now, and the questions to change it.
 * Saving sends only the facts answered, with how they were gathered (PATCH /api/manage/{token}); "Use the sample
 * situation" puts the page back on the sample. A page still on the sample opens with the questions showing.
 */
export function SituationPanel({
  token,
  name,
  pronoun,
  today,
  initial,
  own,
  summary,
  heading,
}: {
  token: string;
  name: string;
  pronoun: Pronoun;
  today: string;
  initial: Answers;
  /** True when the page runs on facts the organizer gave; false while it uses the sample situation. */
  own: boolean;
  /** The page's facts in one line, and what living in someone else's home does to the check, as the server computed them. */
  summary: { line: string; home: string };
  /** Whose facts these are and where they came from, in a few words. */
  heading: string;
}) {
  const router = useRouter();
  const w = pronounWords(pronoun);
  const [editing, setEditing] = useState(!own);
  const [value, setValue] = useState<SituationValue>({ answers: initial, source: "answers" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const base = `/api/manage/${encodeURIComponent(token)}`;

  async function save(body: unknown, done: string) {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch(base, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error?.message ?? "That did not save. Please try again.");
      setMsg(done);
      setEditing(false);
      router.refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mg-sit" data-ui>
      <div className="mg-sit-now">
        <p className="mg-sit-k">{heading}</p>
        <p className="mg-sit-line">{summary.line}</p>
        {summary.home && <p className="mg-sit-home">{summary.home}</p>}
      </div>
      {editing ? (
        <form
          className="mg-sit-form"
          onSubmit={(e) => {
            e.preventDefault();
            const { profile, given } = answersToProfile(value.answers, pronoun);
            const sent = Object.fromEntries(given.map((k) => [k, profile[k]]));
            void save(given.length ? { profile: sent, profile_source: value.source } : { profile: null }, given.length ? `Saved. ${name}'s page now uses these facts.` : "Saved. The page uses the sample situation.");
          }}
        >
          <SituationForm name={name} pronoun={pronoun} today={today} value={value} onChange={setValue} />
          <div className="mg-form-actions">
            <button type="submit" className="btn btn-ink" disabled={busy}>
              {busy ? "Saving…" : anyAnswer(value.answers) ? `Save ${w.poss} situation` : "Save"}
            </button>
            {own && (
              <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => setEditing(false)}>
                Cancel
              </button>
            )}
            {own && (
              <button type="button" className="mg-link" disabled={busy} onClick={() => void save({ profile: null }, "The page uses the sample situation again.")}>
                Use the sample situation
              </button>
            )}
            <span className="mg-note" role="status">
              {msg}
            </span>
          </div>
        </form>
      ) : (
        <div className="mg-form-actions mg-sit-actions">
          <button type="button" className="btn btn-quiet" onClick={() => setEditing(true)}>
            Change {w.poss} situation
          </button>
          <span className="mg-note" role="status">
            {msg}
          </span>
        </div>
      )}
      <p className="mg-sit-fine">Only the answers you save are kept. A letter read to fill them in is not stored.</p>
    </div>
  );
}
