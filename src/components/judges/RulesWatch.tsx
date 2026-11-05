import { connection } from "next/server";
import { rulesWatch } from "@/lib/rules-watch";

const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" });

/** The rules watch, asked live: every Federal Register document that changes SSI's income rules or amounts, with what Giftwise does with it. */
export async function RulesWatch() {
  await connection();
  const w = await rulesWatch();
  const reviewed = w.documents.filter((d) => d.reviewed).length;
  const total = w.documents.length;
  return (
    <>
      <div className="jx-result" data-ui>
        <p className="sx-score" data-short={reviewed === total ? undefined : ""}>
          <span className="tabular">
            {reviewed} of {total}
          </span>{" "}
          rule changes and notices reviewed
        </p>
        <p className="rw-status" data-state={w.status}>
          {w.sentence}
        </p>
      </div>
      <div className="jx-more">
        <details className="jx-disc">
          <summary>All {total} Federal Register documents, and what Giftwise does with each</summary>
          <div className="jx-body rw">
            <div className="doc-table-wrap" tabIndex={0} role="region" aria-label="Federal Register documents and what Giftwise does with each">
              <table className="doc-table">
                <thead>
                  <tr>
                    <th scope="col">Published</th>
                    <th scope="col">Document</th>
                    <th scope="col">What Giftwise does</th>
                  </tr>
                </thead>
                <tbody>
                  {w.documents.map((d) => (
                    <tr key={d.number}>
                      <td className="tabular rw-date">{day(d.published)}</td>
                      <td>
                        <a className="text-link" href={d.url} target="_blank" rel="noreferrer">
                          {d.citation}
                        </a>{" "}
                        <span className="muted">{d.title}</span>
                      </td>
                      <td>{d.how ?? "New: Giftwise reviews it before any rule changes."}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted tech-only">
              src/lib/rules-watch.ts asks api.federalregister.gov three questions (rules for 20 CFR Part 416 that mention in-kind support and maintenance or unearned income since 2022, and SSA&rsquo;s
              cost-of-living notices since 2024) and compares the answers with content/rules-watch.json. GET /api/rules-watch returns the same; the nightly outside checks fail on any document not yet
              reviewed.
            </p>
          </div>
        </details>
      </div>
    </>
  );
}
