/**
 * One section of a long evidence page, closed on load: its heading and one line of what it holds stay in view, and the
 * rest opens on a press or when a link names anything inside it (OpenOnHash). Nothing is removed; the page opens short.
 * The heading sits inside the summary, so the closed page still reads as a list of headings.
 */
export function Fold({ id, title, what, children, headingId }: { id: string; title: React.ReactNode; what: React.ReactNode; children: React.ReactNode; headingId?: string }) {
  return (
    <details id={id} className="ev-fold">
      <summary className="ev-fold-sum">
        <h2 id={headingId ?? `${id}-h`} className="ev-fold-h">
          {title}
        </h2>
        <span className="ev-fold-what">{what}</span>
      </summary>
      <div className="ev-fold-body">{children}</div>
    </details>
  );
}
