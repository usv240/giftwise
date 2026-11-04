import run from "../../../content/eval/invariants-results.json";

const n = (x: number) => x.toLocaleString("en-US");

/** The invariant run: random gifts, needs and people through the router, every answer held to every promise. Read from content/eval/invariants-results.json. */
export function Invariants() {
  const all = run.results.every((r) => r.broken === 0);
  const date = new Date(run.ran_at).toLocaleDateString("en-US", { dateStyle: "medium" });
  return (
    <div className="inv">
      <p className="page-prose">
        {n(run.gifts)} gifts, from one cent to $20,000, to people the generator makes up: living alone or in someone else&rsquo;s home, single or a couple, with or without wages, other income, savings or an
        ABLE account near its yearly limit. Each gift meets up to twelve open needs of every kind, from medicine to rent. {n(run.lines)} recipients in all, {`$${n(Math.round(run.dollars))}`} routed. Every answer
        is held to every promise below{all ? ", and every answer kept every one." : "."}
      </p>
      <div className="doc-table-wrap" tabIndex={0} role="region" aria-label="Promises kept across the random gifts">
        <table className="doc-table">
          <thead>
            <tr>
              <th scope="col">Promise</th>
              <th scope="col">Kept</th>
            </tr>
          </thead>
          <tbody>
            {run.results.map((r) => (
              <tr key={r.id}>
                <td>{r.promise}</td>
                <td className="tabular">
                  {n(r.kept)} of {n(r.kept + r.broken)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="page-prose">
        The first runs sharpened the router four ways. Each line is now checked together with the lines already chosen, so small amounts never add up past the exclusions. ABLE deposits from one gift share the
        year&rsquo;s $20,000 limit, with anything past it handed back. A need marked for ABLE goes only to someone who can have an account. And the month&rsquo;s income is summed to the cent, so the order of
        the amounts never moves a check. Each has its own unit test.
      </p>
      <p className="muted tech-only">
        npx tsx scripts/run-invariants.ts {run.gifts}: seed {run.seed}, so every run is the same {n(run.gifts)} gifts; {Math.round(run.ms / 1000)} s on {date}. src/lib/invariants.ts; 1,000 of them run with every
        npm test.
      </p>
    </div>
  );
}
