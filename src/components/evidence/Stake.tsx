import { Info } from "@/components/Info";
import { LAW, LIMIT, SCALE, UPTAKE, sourceOf, type Figure } from "@/lib/research";

/**
 * The problem, measured by the agency itself, in four parts the impact page folds under their own headings: the scale,
 * the $2,000 limit and ABLE's reach, the published take-up evidence, and the law, the code and the test for each route.
 * Each figure is stated as what it measures, with its source, page date and locator, and the code in Giftwise that
 * answers it.
 */
function Rows({ rows }: { rows: Figure[] }) {
  return (
    <dl className="why-list">
      {rows.map((f) => {
        const s = sourceOf(f.source);
        return (
          <div key={f.id} className="why-row" id={`stake-${f.id}`}>
            <dt>
              <span className="why-fig tabular">{f.figure}</span>
            </dt>
            <dd>
              {f.measures}{" "}
              <a className="text-link" href={s.url} target="_blank" rel="noreferrer">
                {f.sourceLabel}
              </a>
              <span className="muted">
                {" "}
                ({[s.date, f.locator === f.sourceLabel.split(", ").at(-1) ? null : f.locator].filter(Boolean).join("; ")})
              </span>
              <span className="stake-here">
                <span className="cmp-k">In Giftwise. </span>
                {f.inGiftwise}
              </span>
              <span className="tech-only muted stake-code">{f.code.join(", ")}</span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** The problem, measured by Social Security: three figures, then the rest one press away. Its heading is the page's fold. */
export function StakeScale() {
  return (
    <>
      <p className="page-prose jp-intro">
        Each figure is what SSA, its Inspector General or the Federal Register states, read on the page named, with where in it and the part of Giftwise that answers it. Three first; the rest one press
        away. <Info id="evidence.stake" label="" />
      </p>
      <Rows rows={SCALE.slice(0, 3)} />
      <details className="jx-disc stake-more">
        <summary>{SCALE.length - 3} more measures: overpayment shares, what the 2024 rules priced, and how an overpayment is repaid</summary>
        <div className="jx-body">
          <Rows rows={SCALE.slice(3)} />
        </div>
      </details>
    </>
  );
}

/** The $2,000 limit and ABLE's reach. */
export function StakeLimit() {
  return (
    <>
      <p className="page-prose jp-intro">
        What the savings limit costs people today, and how far ABLE reaches. <Info id="evidence.limit" label="" />
      </p>
      <Rows rows={LIMIT} />
    </>
  );
}

/** The published take-up evidence, each study as what it measured. */
export function StakeUptake() {
  return (
    <>
      <p className="page-prose jp-intro">
        None of these studied gifts to people on SSI. They are the published evidence, each in its own program, that doing the steps for people reaches more of them than explaining the steps, which is why Giftwise routes and
        reports rather than advising. <Info id="evidence.uptake" label="" />
      </p>
      <ol className="lin-list">
        {UPTAKE.map((u) => {
          const s = sourceOf(u.source);
          return (
            <li key={u.id} className="lin-item">
              <p className="lin-who">
                <a className="text-link" href={s.url} target="_blank" rel="noreferrer">
                  {u.who}
                </a>
                <span className="muted">
                  {" "}
                  ({s.publisher}, {u.locator})
                </span>
              </p>
              <p className="lin-what">{u.found}</p>
            </li>
          );
        })}
      </ol>
    </>
  );
}

/** The law, the code and the test for each route, on one line. */
export function StakeLaw() {
  return (
    <>
      <p className="page-prose jp-intro">
        The sections that make each route count or not, next to the rule that implements them and the test that holds it. <Info id="evidence.law" label="" />
      </p>
      <div className="cmp-wrap">
        <table className="cmp law">
          <thead>
            <tr>
              <th scope="col">Route</th>
              <th scope="col">The law</th>
              <th scope="col" data-gw="">
                The code
              </th>
              <th scope="col">The test</th>
            </tr>
          </thead>
          <tbody>
            {LAW.map((l) => (
              <tr key={l.rule}>
                <th scope="row">{l.route}</th>
                <td>
                  {l.law.map((x, i) => (
                    <span key={x.key}>
                      {i > 0 ? "; " : ""}
                      <a className="text-link" href={sourceOf(x.key).url} target="_blank" rel="noreferrer">
                        {x.label}
                      </a>
                    </span>
                  ))}
                </td>
                <td data-gw="">
                  <span className="tabular">{l.rule}</span>
                  <span className="tech-only muted law-code">{l.code}</span>
                </td>
                <td>{l.test}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
