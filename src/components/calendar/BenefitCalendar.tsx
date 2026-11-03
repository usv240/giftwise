"use client";

import "@bryntum/calendar/calendar.css";
import "@bryntum/calendar/fontawesome/css/fontawesome.css";
import "@bryntum/calendar/fontawesome/css/solid.css";
import { StringHelper, type EventModel } from "@bryntum/calendar";
import { BryntumCalendar } from "@bryntum/calendar-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calendarModel, checkChanges, type CalGift, type View } from "@/lib/calendar/model";
import { ensureBryntumTheme } from "./theme";
import { usd, type Profile } from "@/lib/rules";

const RESOURCES = [
  { id: "kept", name: "Not counted", eventColor: "green" },
  { id: "counts", name: "Counts as income", eventColor: "orange" },
  { id: "ssa", name: "Social Security", eventColor: "blue" },
];
/** Month view only. Events are 26px tall so each one is a comfortable target on a phone; the week numbers add nothing here. */
const MODES = { day: null, week: null, year: null, agenda: null, month: { eventHeight: 26, eventSpacing: 3, showWeekColumn: false } };
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

type Move = { id: string; label: string; from: string; to: string; changes: { paidOn: string; before: number; after: number }[] };

export function BenefitCalendar({ gifts: initial, profile, name, month, poss }: { gifts: CalGift[]; profile: Profile; name: string; month: string; poss: string }) {
  useBryntumTheme();
  const calRef = useRef<HTMLDivElement>(null);
  const getRoot = useCallback(() => calRef.current, []);
  useButtonNames(getRoot);
  const [gifts, setGifts] = useState(initial);
  const [view, setView] = useState<View>("given");
  const [moves, setMoves] = useState<Move[]>([]);
  const [date] = useState(() => new Date(`${month}-15T12:00:00`));
  const [pick, setPick] = useState(initial.at(-1)?.id ?? "");
  const [to, setTo] = useState(initial.at(-1)?.date ?? `${month}-01`);

  const model = useMemo(() => calendarModel(gifts, profile, view), [gifts, profile, view]);
  const counted = model.events.filter((e) => e.resourceId === "counts").length;

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
            }}
          >
            Put every gift back
          </button>
        )}
      </div>
      <p className="bc-hint muted">
        {view === "given"
          ? `${counted === 0 ? "Nothing here counts as income." : `${counted} of these count as income.`} Drag a gift to another day, or use the form below, and the rules run again.`
          : `The same gifts as cash. Move one across the end of a month or a quarter and watch which check it lowers.`}
      </p>
      <div className="bc-cal" ref={calRef}>
        <BryntumCalendar
          date={date}
          mode="month"
          modes={MODES}
          sidebar={false}
          tbar={TBAR}
          weekStartDay={0}
          resources={RESOURCES}
          events={model.events}
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
          <button type="submit" className="btn btn-primary">
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
