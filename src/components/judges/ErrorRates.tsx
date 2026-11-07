import { Info } from "@/components/Info";
import { ERROR_RATES as E, type ErrorSource, type Tally } from "@/lib/error-rates";

const n = (x: number) => x.toLocaleString("en-US");
const of = (t: { errors: number; of: number }) => `${n(t.errors)} of ${n(t.of)}`;
const SHORT: Record<ErrorSource["id"], string> = { ssa: "SSA's examples", court: "court cases", bills: "bills" };
/** Each source's count for one rate, skipping a source with no case of that kind. */
const bySource = (key: "lowered" | "held") =>
  E.sources
    .filter((s) => s[key].of > 0)
    .map((s) => `${SHORT[s.id]} ${of(s[key])}`)
    .join(", ");
const ids = (t: Tally) => (t.ids.length ? ` Cases: ${t.ids.join(", ")}.` : "");
const FILES = [...new Set(E.sources.flatMap((s) => s.file.split(", ")))].join(", ");
const ROUTE_WORDS: Record<string, string> = { able: "her ABLE account", vendor: "the shop", item: "the item" };

/** Why the held gifts were held, said only when the recorded run shows it for every one. */
function heldWhy() {
  if (E.held.errors === 0) return "None were rerouted or held.";
  const allBills = E.held.errors === E.sources.find((s) => s.id === "bills")!.held.errors;
  if (!allBills || !E.heldUnsettled) return null;
  const where = E.heldRoutes.length === 1 && ROUTE_WORDS[E.heldRoutes[0] ?? ""] ? ROUTE_WORDS[E.heldRoutes[0]!] : "the safe route";
  return `${E.held.errors === 1 ? "It is a" : `All ${n(E.held.errors)} are`} ${E.heldHardSet ? "hard " : ""}bill${E.held.errors === 1 ? "" : "s"} the two reviewers did not settle, so the money went to ${where} instead of the shop${E.heldCheckWhole ? ", and her check stayed whole" : ""}.`;
}

const court = E.sources.find((s) => s.id === "court")!;

/**
 * The two errors that cost money, right under the results: a gift let through that the rule counts, and a gift fine as
 * given that Giftwise sent another way. Every figure is counted by src/lib/error-rates.ts from the recorded runs.
 */
export function ErrorRates() {
  const why = heldWhy();
  return (
    <section className="je" aria-labelledby="je-h" data-ui>
      <div className="je-top">
        <h2 id="je-h" className="je-h">
          The two errors that cost money
        </h2>
        <Info id="evidence.errors" label="" />
      </div>
      <ul className="je-list">
        <li className="je-item">
          <p className="je-fig tabular" data-zero={E.lowered.errors === 0 ? "" : undefined}>
            {of(E.lowered)}
          </p>
          <div className="je-body">
            <p className="je-what">gifts that would lower the check, let through as given.</p>
            <p className="je-def">Giftwise said safe as given, and SSA, the court or the bill&rsquo;s label says it counts.</p>
            <p className="je-by tabular">{bySource("lowered")}.</p>
            <p className="je-tech tech-only">
              Counted by src/lib/error-rates.ts from {FILES}. Claude with no rulebook, same bills: {of(E.billsWithoutRulebook.lowered)}. Inside the engine, {n(E.randomGifts.gifts)} random gifts: {n(E.randomGifts.lowered)} routes
              lowered her check (content/eval/invariants-results.json).{ids(E.lowered)}
            </p>
          </div>
        </li>
        <li className="je-item">
          <p className="je-fig tabular" data-zero={E.held.errors === 0 ? "" : undefined}>
            {of(E.held)}
          </p>
          <div className="je-body">
            <p className="je-what">gifts that were fine as given, sent another way.</p>
            <p className="je-def">The rule treats the gift as fine as given, and Giftwise rerouted or held it.</p>
            {why && <p className="je-def">{why}</p>}
            <p className="je-by tabular">{bySource("held")}.</p>
            <p className="je-tech tech-only">
              The {n(E.contestedBills)} contested bills have no single right answer and count in neither rate{court.held.of === 0 ? `; all ${n(court.lowered.of)} court cases counted, so they add to the first rate only` : ""}. Claude with no
              rulebook, same bills: {of(E.billsWithoutRulebook.held)}.{ids(E.held)}
            </p>
          </div>
        </li>
      </ul>
    </section>
  );
}
