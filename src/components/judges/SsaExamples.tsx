import data from "../../../content/eval/ssa-examples.json";
import results from "../../../content/eval/ssa-examples-results.json";
import sources from "../../../content/sources.json";
import { usd } from "@/lib/rules";

const SRC = sources as Record<string, { title: string; url: string }>;
type Value = { month: string; measure: keyof typeof data.measures; value: number; got: number | null };
type Side = { counts: boolean; values: Value[]; match: boolean; reason?: string; rules?: string[] };
type Row = { id: string; engine: Side; claude: Side | null };
const ROWS = new Map((results.cases as Row[]).map((r) => [r.id, r]));
const S = results.summary;
const MONTH = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const month = (m: string) => MONTH.format(new Date(`${m}-15T12:00:00Z`));
const MEASURE: Record<string, string> = { after_infrequent: "counted", ism_value: "housing support", ssi_amount: "SSI amount" };

function Verdict({ side }: { side: Side | null }) {
  if (!side) return <span className="muted">Not run</span>;
  return (
    <span className="sx-verdict" data-ok={side.match ? "" : undefined}>
      {side.match ? "Matches" : "Differs"}
    </span>
  );
}

/** What a side said, month by month, next to SSA's number. */
function Figures({ side }: { side: Side }) {
  return (
    <ul className="sx-figures">
      {side.values.map((v) => (
        <li key={v.month + v.measure} data-ok={v.got !== null && Math.abs(v.got - v.value) <= results.tolerance_usd ? "" : undefined}>
          {month(v.month)}, {MEASURE[v.measure]}: <span className="tabular">{v.got === null ? "no answer" : usd(v.got)}</span>
          <span className="muted"> (SSA {usd(v.value)})</span>
        </li>
      ))}
    </ul>
  );
}

/** Social Security's own worked examples, answered by the rules engine and by Claude with no rulebook. */
export function SsaExamples() {
  const ran = new Date(results.ran_at).toLocaleDateString("en-US", { dateStyle: "medium" });
  return (
    <div className="sx" data-ui>
      <p className="sx-score">
        <span className="tabular">
          {S.engine_matches} of {S.cases}
        </span>{" "}
        match Social Security&rsquo;s own answers.
      </p>
      <p className="sx-vs">
        Claude alone, asked the same questions with no rulebook and no rules engine:{" "}
        <strong className="tabular">
          {S.claude_matches} of {S.claude_answered}
        </strong>
        . It missed the $60 quarterly exclusion for one-time gifts three times. Giftwise does that arithmetic in code.
      </p>
      <p className="sx-meta muted">
        {S.cases} worked examples from {new Set(data.cases.map((c) => c.cite)).size} sections of SSA&rsquo;s operating manual, each about a gift or similar help to one person. The facts and answers are
        SSA&rsquo;s, with dates moved to 2026 so 2026 amounts apply. Examples Giftwise does not model are listed at the end with the reason. Run {ran}; Claude is {results.model}.
      </p>

      <div className="sx-findings">
        {data.findings.map((f) => (
          <div key={f.id} className="sx-finding" data-open={f.fixed ? undefined : ""}>
            <p className="sx-finding-k">{f.fixed ? "Found and fixed" : "Still open"}</p>
            <p>{f.found}</p>
            {f.fixed && <p>{f.fixed}</p>}
          </div>
        ))}
      </div>

      <ol className="sx-list">
        {data.cases.map((c) => {
          const r = ROWS.get(c.id);
          if (!r) return null;
          return (
            <li key={c.id}>
              <details className="sx-case">
                <summary>
                  <span className="sx-title">{c.title}</span>
                  <span className="sx-sides">
                    <span className="sx-side">
                      <span className="sx-who">Giftwise</span> <Verdict side={r.engine} />
                    </span>
                    <span className="sx-side">
                      <span className="sx-who">Claude alone</span> <Verdict side={r.claude} />
                    </span>
                  </span>
                </summary>
                <div className="sx-body">
                  <p>
                    <strong>SSA&rsquo;s answer:</strong> {c.ssa_answer}
                  </p>
                  {"updated" in c && c.updated && <p className="sx-note">{c.updated.note}</p>}
                  <blockquote className="sx-quote">
                    <p>{c.passage}</p>
                    <footer>
                      <a className="text-link" href={SRC[c.source]?.url} target="_blank" rel="noreferrer">
                        {c.cite} {c.part}
                      </a>
                    </footer>
                  </blockquote>
                  <p className="muted">Asked: {c.situation} {c.question}</p>
                  <div className="sx-answers">
                    <div>
                      <p className="sx-who">Giftwise</p>
                      <Figures side={r.engine} />
                      {r.engine.rules && <p className="sx-rules tech-only">Rules {r.engine.rules.join(", ")}</p>}
                    </div>
                    {r.claude && (
                      <div>
                        <p className="sx-who">Claude alone</p>
                        <Figures side={r.claude} />
                        {r.claude.reason && <p className="sx-reason muted">{r.claude.reason}</p>}
                      </div>
                    )}
                  </div>
                  {"input_note" in c && c.input_note && <p className="sx-note muted">{c.input_note}</p>}
                </div>
              </details>
            </li>
          );
        })}
      </ol>

      <details className="sx-out">
        <summary>Examples Giftwise does not model, and why</summary>
        <ul>
          {data.out_of_scope.map((o) => (
            <li key={o.cite}>
              <strong>{o.what}</strong> <span className="muted">({o.cite})</span>. {o.why}
            </li>
          ))}
        </ul>
      </details>
      <p className="sx-cmd muted tech-only">npx tsx --env-file=.env.local scripts/run-ssa-examples.ts (add --engine to skip the Claude calls)</p>
    </div>
  );
}
