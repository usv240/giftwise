import type { ReactNode } from "react";

/**
 * A long list of cases: the first few in view, the rest one press away, so the five-minute path stays short while every
 * case stays on the page (and in its HTML, for search and for anyone reading without script).
 */
export function ShowSome<T>({ rows, render, noun, first = 6 }: { rows: T[]; render: (row: T) => ReactNode; noun: string; first?: number }) {
  const head = rows.slice(0, first);
  const rest = rows.slice(first);
  return (
    <>
      <ol className="sx-list">{head.map(render)}</ol>
      {rest.length > 0 && (
        <details className="sx-rest">
          <summary>
            <span className="sx-rest-closed">
              Show all {rows.length} {noun}
            </span>
            <span className="sx-rest-open">Show only the first {first}</span>
          </summary>
          <ol className="sx-list sx-list-rest" start={first + 1}>
            {rest.map(render)}
          </ol>
        </details>
      )}
    </>
  );
}
