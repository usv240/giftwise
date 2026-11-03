import content from "../../content/real-world.json";
import sources from "../../content/sources.json";
import { Info } from "./Info";

const SRC = sources as Record<string, { title: string; url: string; publisher: string }>;

export type RealWorldItem = { id: string; q: string; a: string; tech: string; sources: string[] };
export const REAL_WORLD = content.items as RealWorldItem[];

/** A citation keeps only its number ("POMS SI 01130.740"); a named page keeps its whole title ("STABLE: Gifting"). */
const short = (k: string) => {
  const [head] = SRC[k].title.split(":");
  return /\d/.test(head) ? head : SRC[k].title;
};

/**
 * What changes outside the sandbox: how a shop becomes a payee, how money reaches an ABLE account, and who pays the fees.
 * Shared by the gift page and /about; each answer opens on its own and cites where it comes from.
 */
export function RealWorld({ headingId = "real-h", open }: { headingId?: string; open?: string }) {
  return (
    <section className="rw" aria-labelledby={headingId} data-ui>
      <div className="title-row">
        <h2 id={headingId} className="rw-title">
          How this works for real
        </h2>
        <Info id="real.world" label="" />
      </div>
      <p className="rw-intro">{content.intro}</p>
      <div className="rw-list">
        {REAL_WORLD.map((it) => (
          <details key={it.id} id={`real-${it.id}`} className="rw-item" open={open === it.id || undefined}>
            <summary>{it.q}</summary>
            <div className="rw-body">
              <p>{it.a}</p>
              <p className="rw-tech">{it.tech}</p>
              <p className="rw-src">
                Sources:{" "}
                {it.sources.map((k, i) => (
                  <span key={k}>
                    <a className="text-link" href={SRC[k].url} target="_blank" rel="noreferrer">
                      {short(k)}
                    </a>
                    {i < it.sources.length - 1 ? ", " : ""}
                  </span>
                ))}
              </p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
