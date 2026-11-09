import { Info } from "@/components/Info";
import { LAW, LIMIT, SCALE, UPTAKE, sourceOf, type Figure } from "@/lib/research";

/**
 * The problem, measured by the agency itself: three figures open, the rest one press away, then the $2,000 limit and
 * ABLE's reach, the published take-up evidence, and the law, the code and the test for each route on one line. Each
 * figure is stated as what it measures, with its source and page date, and the code in Giftwise that answers it.
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
              {s.date ? <span className="muted"> ({s.date})</span> : null}
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

export function Stake() {
  return (
    <>
      <section id="stake" className="page-section" aria-labelledby="stake-h">
        <div className="title-row">
          <h2 id="stake-h">The problem, measured by Social Security</h2>
          <Info id="evidence.stake" label="" />
        </div>
        <p className="page-prose jp-intro">
          Each figure is what SSA, its Inspector General or the Federal Register states, read on the page named, with the part of Giftwise that answers it. Three first; the rest one press away.
        </p>
        <Rows rows={SCALE.slice(0, 3)} />
        <details className="jx-disc stake-more">
          <summary>{SCALE.length - 3} more measures: overpayment shares, what the 2024 rules priced, and how an overpayment is repaid</summary>
          <div className="jx-body">
            <Rows rows={SCALE.slice(3)} />
          </div>
        </details>
      </section>

      <section id="limit" className="page-section" aria-labelledby="limit-h">
        <div className="title-row">
          <h2 id="limit-h">The $2,000 limit, and ABLE&rsquo;s reach</h2>
          <Info id="evidence.limit" label="" />
        </div>
        <Rows rows={LIMIT} />
      </section>

      <section id="uptake" className="page-section" aria-labelledby="uptake-h">
        <div className="title-row">
          <h2 id="uptake-h">Simpler processes raise take-up</h2>
          <Info id="evidence.uptake" label="" />
        </div>
        <p className="page-prose jp-intro">
          None of these studied gifts to people on SSI. They are the published evidence, each in its own program, that doing the steps for people reaches more of them than explaining the steps, which is why Giftwise routes and
          reports rather than advising.
        </p>
        <details className="jx-disc">
          <summary>{UPTAKE.length} studies, each as what it measured</summary>
          <div className="jx-body">
            <ol className="lin-list">
              {UPTAKE.map((u) => {
                const s = sourceOf(u.source);
                return (
                  <li key={u.id} className="lin-item">
                    <p className="lin-who">
                      <a className="text-link" href={s.url} target="_blank" rel="noreferrer">
                        {u.who}
                      </a>
                      <span className="muted"> ({s.publisher})</span>
                    </p>
                    <p className="lin-what">{u.found}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </details>
      </section>

      <section id="law" className="page-section" aria-labelledby="law-h">
        <div className="title-row">
          <h2 id="law-h">The law, the code and the test</h2>
          <Info id="evidence.law" label="" />
        </div>
        <p className="page-prose jp-intro">The sections that make each route count or not, next to the rule that implements them and the test that holds it.</p>
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
      </section>
    </>
  );
}
