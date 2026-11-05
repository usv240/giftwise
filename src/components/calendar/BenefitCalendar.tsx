"use client";

import "@bryntum/calendar/calendar.css";
import "@bryntum/calendar/fontawesome/css/fontawesome.css";
import "@bryntum/calendar/fontawesome/css/solid.css";
import { StringHelper, type EventModel } from "@bryntum/calendar";
import { BryntumCalendar } from "@bryntum/calendar-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { calendarModel, checkChanges, type CalGift, type View } from "@/lib/calendar/model";
import { planDates } from "@/lib/calendar/schedule";
import { ensureBryntumTheme } from "./theme";
import { usd, type Profile } from "@/lib/rules";

const RESOURCES = [
  { id: "kept", name: "Not counted", eventColor: "green" },
  { id: "counts", name: "Counts as income", eventColor: "orange" },
  { id: "ssa", name: "Social Security", eventColor: "blue" },
];
/**
 * One view at a time. On a wide screen, the month grid: events 26px tall, and no week numbers (MonthView puts one in
 * the corner of each Sunday cell unless showWeekNumber is off). On a phone, seven columns leave about 50px a day and
 * every title reads "SSI c...", so the same month shows as a list, one gift per row with its full title.
 */
const MODES_WIDE = { day: null, week: null, year: null, agenda: null, month: { eventHeight: 26, eventSpacing: 3, showWeekColumn: false, showWeekNumber: false } };
const MODES_NARROW = { day: null, week: null, year: null, month: null, agenda: { range: "month", listRangeMenu: null } };
const NARROW = "(max-width: 600px)";
const watchNarrow = (onChange: () => void) => {
  const m = window.matchMedia(NARROW);
  m.addEventListener("change", onChange);
  return () => m.removeEventListener("change", onChange);
};
const DRAG = { creatable: false, resizable: false };
/** One view, so no mode switch and no sidebar toggle; the arrows get names a screen reader can say. */
const TBAR = { items: { toggleSidebar: null, modeSelector: null, todayButton: { ariaLabel: "Today" }, prevButton: { ariaLabel: "Previous month", tooltip: "Previous month" }, nextButton: { ariaLabel: "Next month", tooltip: "Next month" } } };
const TOOLTIP = { renderer: ({ eventRecord }: { eventRecord: EventModel }) => `<p class="bc-tip">${StringHelper.encodeHtml(String((eventRecord as EventModel & { note?: string }).note ?? eventRecord.name))}</p>` };
const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const short = (iso: string) => DAY.format(new Date(`${iso}T12:00:00Z`));
const localIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Bryntum's toolbar arrows carry only an icon; give every unnamed button a name screen readers can say. */
const BUTTON_NAMES: Record<string, string> = { prevButton: "Previous month", nextButton: "Next month", todayButton: "Today" };
function useButtonNames(root: () => HTMLElement | null) {
  useEffect(() => {
    const el = root();
    if (!el) return;
    const label = () => {
      for (const b of el.querySelectorAll<HTMLElement>("button, [role=button]")) {
        // innerText, not textContent: on a phone the label is hidden and only the icon shows.
        if (b.getAttribute("aria-label") || (b.innerText ?? "").trim()) continue;
        const name = BUTTON_NAMES[b.dataset.ref ?? ""] ?? (b.querySelector(".b-icon-previous, .b-icon-angle-left") ? "Previous month" : b.querySelector(".b-icon-next, .b-icon-angle-right") ? "Next month" : null);
        if (name) b.setAttribute("aria-label", name);
      }
    };
    label();
    const watch = new MutationObserver(label);
    watch.observe(el, { childList: true, subtree: true });
    return () => watch.disconnect();
  }, [root]);
}

/** Keep the Bryntum theme in step with the site's light and dark mode. The loader put the first one in place. */
function useBryntumTheme() {
  useEffect(() => {
    const watch = new MutationObserver(() => void ensureBryntumTheme());
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => watch.disconnect();
  }, []);
}

type Move = { id: string; label: string; from: string; to: string; changes: { paidOn: string; before: number; after: number }[]; byPlanner?: boolean };
type PlanState = { status: "idle" | "planning" | "moving" | "done"; kept?: number; moved?: number; gap?: number; note?: string };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sumChecks = (c: { amount: number }[]) => Math.round(c.reduce((a, x) => a + x.amount, 0) * 100) / 100;

export function BenefitCalendar({ gifts: initial, profile, name, month, poss }: { gifts: CalGift[]; profile: Profile; name: string; month: string; poss: string }) {
  useBryntumTheme();
  const calRef = useRef<HTMLDivElement>(null);
  const getRoot = useCallback(() => calRef.current, []);
  useButtonNames(getRoot);
  const narrow = useSyncExternalStore(watchNarrow, () => window.matchMedia(NARROW).matches, () => false);
  const [gifts, setGifts] = useState(initial);
  const [view, setView] = useState<View>("given");
  const [moves, setMoves] = useState<Move[]>([]);
  // The grid centres on mid-month; the list starts at the top of the month, so its first row is the 1st.
  const [date] = useState(() => new Date(`${month}-15T12:00:00`));
  const [first] = useState(() => new Date(`${month}-01T12:00:00`));
  const [pick, setPick] = useState(initial.at(-1)?.id ?? "");
  const [to, setTo] = useState(initial.at(-1)?.date ?? `${month}-01`);

  const [plan, setPlan] = useState<PlanState>({ status: "idle" });
  const [moved, setMoved] = useState<Set<string>>(new Set());
  const model = useMemo(() => calendarModel(gifts, profile, view), [gifts, profile, view]);
  const events = useMemo(() => model.events.map((e) => (moved.has(e.id) ? { ...e, cls: "bc-moved", name: `${e.name}, moved` } : e)), [model.events, moved]);
  const counted = model.events.filter((e) => e.resourceId === "counts").length;

  /** The planner: find the days that keep more of the check, then move each gift on the calendar, one at a time. */
  async function runPlanner() {
    setPlan({ status: "planning" });
    await sleep(30);
    const p = planDates(gifts, profile, view);
    if (!p.moves.length) {
      setPlan({ status: "done", moved: 0, note: view === "given" ? "Nothing here counts as income, so there is nothing to move." : "No move of a week or less keeps more of the check for these gifts." });
      return;
    }
    setPlan({ status: "moving" });
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cur = gifts;
    const months = gifts.map((g) => g.date.slice(0, 7)).sort();
    const span = { first: months[0], last: months.at(-1)! };
    for (const m of p.moves) {
      const next = cur.map((x) => (x.id === m.id ? { ...x, date: m.to } : x)).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
      const changes = checkChanges(calendarModel(cur, profile, view, span).checks, calendarModel(next, profile, view, span).checks);
      cur = next;
      setGifts(next);
      setMoved((s) => new Set(s).add(m.id));
      setMoves((x) => [{ id: m.id, label: `The planner moved ${m.giver}'s ${usd(m.amount)}`, from: m.from, to: m.to, changes, byPlanner: true }, ...x].slice(0, 6));
      await sleep(reduce ? 0 : 900);
    }
    // The same gifts paid the Giftwise way, against the best the planner found for cash.
    const given = sumChecks(calendarModel(initial, profile, "given", span).checks);
    setPlan({ status: "done", kept: p.kept, moved: p.moves.length, gap: Math.round((given - p.after) * 100) / 100 });
  }

  function move(id: string, newDate: string) {
    const g = gifts.find((x) => x.id === id);
    if (!g || !/^\d{4}-\d{2}-\d{2}$/.test(newDate) || newDate === g.date) return;
    const next = gifts.map((x) => (x.id === id ? { ...x, date: newDate } : x)).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const months = [...gifts, ...next].map((x) => x.date.slice(0, 7)).sort();
    const span = { first: months[0], last: months.at(-1)! };
    const changes = checkChanges(calendarModel(gifts, profile, view, span).checks, calendarModel(next, profile, view, span).checks);
    setGifts(next);
    setMoves((m) => [{ id, label: `${g.giver}'s ${usd(g.amount)}`, from: g.date, to: newDate, changes }, ...m].slice(0, 5));
  }

  return (
    <div className="bc" data-ui>
      <div className="bc-bar">
        <div className="bc-views" role="group" aria-label="How the gifts arrived">
          <button type="button" className="bc-view" aria-pressed={view === "given"} onClick={() => setView("given")}>
            As given
          </button>
          <button type="button" className="bc-view" aria-pressed={view === "cash"} onClick={() => setView("cash")}>
            As cash
          </button>
        </div>
        <ul className="bc-legend" aria-label="Colors">
          <li data-k="kept">Not counted</li>
          <li data-k="counts">Counts as income</li>
          <li data-k="ssa">Social Security</li>
        </ul>
        {moves.length > 0 && (
          <button
            type="button"
            className="text-link bc-reset"
            onClick={() => {
              setGifts(initial);
              setMoves([]);
              setMoved(new Set());
              setPlan({ status: "idle" });
            }}
          >
            Put every gift back
          </button>
        )}
      </div>
      {/* The planner is what this calendar is for, so it comes before the grid it moves gifts on. */}
      <div className="bc-planner" aria-live="polite">
        <div>
          <p className="bc-k">Let the planner move the cash</p>
          <p className="bc-planner-text">
            {plan.status === "done" && plan.moved
              ? `The planner moved ${plan.moved} cash ${plan.moved === 1 ? "gift" : "gifts"} by a week or less and kept ${usd(plan.kept ?? 0)} more of ${poss.toLowerCase()} checks across the year. Paying the shop instead keeps ${usd(Math.max(0, plan.gap ?? 0))} more than the best cash schedule.`
              : plan.status === "done"
                ? plan.note
                : `Some relatives give cash whatever happens. The planner moves each cash gift by up to a week so that more of it falls under SSI's $20 monthly and $60 quarterly exclusions. It never moves a gift into a month with no check, because that can affect Medicaid.`}
          </p>
        </div>
        <button type="button" className="btn btn-ink bc-plan-btn" onClick={() => void runPlanner()} disabled={plan.status === "planning" || plan.status === "moving"}>
          {plan.status === "planning" ? "Planning…" : plan.status === "moving" ? "Moving the gifts…" : view === "cash" ? "Plan the cash dates" : "Check for cash to move"}
        </button>
      </div>

      <p className="bc-hint muted">
        {view === "given"
          ? `${counted === 0 ? "Nothing here counts as income." : `${counted} of these count as income.`} ${narrow ? "Move a gift with the form below" : "Drag a gift to another day, or use the form below"}, and the rules run again.`
          : `The same gifts as cash. Move one across the end of a month or a quarter and watch which check it lowers.`}
      </p>
      <div className="bc-cal" ref={calRef} data-mode={narrow ? "list" : "month"}>
        <BryntumCalendar
          key={narrow ? "list" : "month"}
          date={narrow ? first : date}
          mode={narrow ? "agenda" : "month"}
          modes={narrow ? MODES_NARROW : MODES_WIDE}
          sidebar={false}
          tbar={TBAR}
          weekStartDay={0}
          resources={RESOURCES}
          events={events}
          eventEditFeature={false}
          eventMenuFeature={false}
          scheduleMenuFeature={false}
          dragFeature={DRAG}
          eventTooltipFeature={TOOLTIP}
          onDragMoveEnd={({ eventRecord }: { eventRecord: EventModel }) => move(String(eventRecord.id), localIso(eventRecord.startDate as Date))}
        />
      </div>

      <div className="bc-under">
        <form
          className="bc-move"
          onSubmit={(e) => {
            e.preventDefault();
            move(pick, to);
          }}
        >
          <p className="bc-k">Move a gift</p>
          <label>
            Gift
            <select value={pick} onChange={(e) => setPick(e.target.value)}>
              {gifts.map((g) => (
                <option key={g.id} value={g.id}>
                  {short(g.date)}: {g.giver}, {usd(g.amount)}
                </option>
              ))}
            </select>
          </label>
          <label>
            New day
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button type="submit" className="btn btn-ink">
            Move it
          </button>
        </form>
        <div className="bc-moves" aria-live="polite">
          <p className="bc-k">What moving it did</p>
          {moves.length === 0 ? (
            <p className="muted">Nothing moved yet. {name}&rsquo;s checks are on the 1st of each month in blue.</p>
          ) : (
            <ul>
              {moves.map((m, i) => (
                <li key={i}>
                  <strong>{m.label}</strong>, {short(m.from)} to {short(m.to)}:{" "}
                  {m.changes.length === 0
                    ? `no check changes. ${view === "given" ? `Paid this way it is not income on any day.` : `It stays in the same month and quarter.`}`
                    : m.changes.map((c, j) => (
                        <span key={c.paidOn}>
                          {j > 0 && "; "}
                          {poss} {short(c.paidOn)} check <span className="tabular">{usd(c.before)}</span> to <span className="tabular">{usd(c.after)}</span>
                        </span>
                      ))}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
