import sources from "../../../content/sources.json";
import { Info } from "@/components/Info";

const SRC = sources as Record<string, { title: string; url: string; date?: string }>;

/**
 * Where the two-reviewer design comes from: the published ideas it builds on, each with what it does and how this
 * design differs, and the one part that is new here. Under /evidence/rules#referee, one press away.
 */
const LINEAGE: { id: string; who: string; what: string; here: string }[] = [
  { id: "zheng-2023-judge", who: "Zheng and others, 2023", what: "A model judges answers, and the paper names the biases that come with it: position, length, a preference for its own style.", here: "Here the model reviews a bill against a rulebook, not a chatbot answer, and must quote the text it relies on." },
  { id: "verga-2024-poll", who: "Verga and others, 2024", what: "A panel of smaller models from different families beats one large judge, with less of any one model's bias.", here: "Here the panel varies the rulebook, not the model: one reviewer reads only the regulations, the other only SSA's manual." },
  { id: "kohli-2026-panels", who: "Kohli, 2026", what: "Nine models from seven families give about two independent votes, because they make the same mistakes on the same items.", here: "The reason the two reviewers read different texts: independence has to come from the input, not from the model's name." },
  { id: "jung-2024-trust-escalate", who: "Jung, Brahman and Choi, 2024", what: "A judge answers only when it is confident and otherwise escalates to a stronger model, with a guaranteed level of agreement with people.", here: "Here the escalation is not to a bigger model but to the route that keeps the check whole under either reading, chosen by code." },
  { id: "badshah-2026-abstain", who: "Badshah, Emami and Sajjad, 2026", what: "If unsure, retrieve evidence and judge again; if still unsure, abstain and flag the case for a person.", here: "Here abstention follows disagreement between two reviewers reading different rulebooks, after code has checked every quote word for word." },
  { id: "madras-2018-defer", who: "Madras, Pitassi and Zemel, 2018", what: "A model learns when to defer a decision to a person, taking that person's own errors into account.", here: "The defer-to-a-person lineage. Giftwise defers to a safe route in code, and a person approves every payment in PayPal." },
  { id: "geifman-2017-selective", who: "Geifman and El-Yaniv, 2017", what: "A classifier with a reject option, set by the risk a user accepts and the coverage that gives.", here: "The two error rates on this page, a wrong route accepted and a fine gift sent another way, follow that risk-and-coverage framing." },
];

export function Lineage() {
  const vendor = SRC["anthropic-building-agents"];
  return (
    <section id="lineage" className="page-section jx" aria-labelledby="lineage-h">
      <div className="jx-head">
        <div className="title-row">
          <h2 id="lineage-h">Where the two-reviewer design comes from</h2>
          <Info id="evidence.lineage" label="" />
        </div>
        <p className="page-prose jp-intro">
          Using a model as a reviewer, letting it abstain, and handing the hard cases on are published ideas. The part that is new here is narrower: the two reviewers read two different rulebooks (20 CFR Part 416,
          and SSA&rsquo;s operating manual), so their independence comes from the text and not from the model; code checks every quote word for word; and when they disagree, the referee takes the route that keeps
          her check whole under either reading.
        </p>
      </div>
      <details className="jx-disc">
        <summary>The published ideas, and how this one differs</summary>
        <div className="jx-body">
          <ol className="lin-list">
            {LINEAGE.map((l) => (
              <li key={l.id} className="lin-item">
                <p className="lin-who">
                  <a className="text-link" href={SRC[l.id].url} target="_blank" rel="noreferrer">
                    {l.who}
                  </a>
                  {SRC[l.id].date && SRC[l.id].date !== l.who.slice(-4) ? <span className="muted"> ({SRC[l.id].date})</span> : null}
                </p>
                <p className="lin-what">{l.what}</p>
                <p className="lin-here">{l.here}</p>
              </li>
            ))}
          </ol>
          <p className="lin-credit">
            &ldquo;The agent proposes, a person approves&rdquo;, the way the assistant on /agents starts a checkout only the giver can approve, is a pattern many agent products share this year and is vendor
            guidance (
            <a className="text-link" href={vendor.url} target="_blank" rel="noreferrer">
              Anthropic, Building effective agents
            </a>
            , {vendor.date}). It is done carefully here; it is not the headline.
          </p>
          <p className="tech-only muted">referee() and routeForDecision() in src/lib/review/referee.ts; checkVote() checks each quote against the reviewer&rsquo;s own rulebook; tests/referee.test.ts.</p>
        </div>
      </details>
    </section>
  );
}
