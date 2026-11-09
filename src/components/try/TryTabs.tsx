"use client";

import Papa from "papaparse";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Info } from "../Info";
import { ResultCard } from "../ResultCard";
import { AiBudget } from "./AiBudget";
import { MakeGiftPage } from "./MakeGiftPage";
import { ReviewPanel, replayedSource, type ReviewData, type ReviewInput } from "./ReviewPanel";
import type { SampleRead } from "@/lib/ai/sample-bill";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { usePrefs } from "../prefs";
import { modelName } from "@/lib/ai/model-name";
import { parseDollars, parseOptionalDollars } from "@/lib/parseDollars";
import { billDescription } from "@/lib/review/bill-route";
import { DEFAULT_PROFILE, checkMonthName, evaluateGift, fbr, monthName, planMonths, usd, type Category, type Delivery, type Gift, type Profile } from "@/lib/rules";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "equipment", label: "Equipment or repair" },
  { value: "medical", label: "Medical care or medicine" },
  { value: "phone", label: "Phone bill" },
  { value: "internet", label: "Internet" },
  { value: "education", label: "School costs" },
  { value: "clothing", label: "Clothing" },
  { value: "transport", label: "Transport" },
  { value: "food", label: "Food" },
  { value: "personal", label: "Personal item" },
  { value: "event", label: "Event tickets" },
  { value: "utility", label: "Utilities (power, gas, water)" },
  { value: "rent", label: "Rent" },
  { value: "mortgage", label: "Mortgage" },
  { value: "property_tax", label: "Property tax" },
  { value: "other", label: "Something else" },
];
const DELIVERIES: { value: Delivery; label: string }[] = [
  { value: "cash", label: "Cash to her" },
  { value: "vendor", label: "Pay the shop" },
  { value: "item", label: "Give the item" },
  { value: "able", label: "To her ABLE account" },
];

export const CSV_TEMPLATE = `date,giver,amount,description,paid_to,category,recurring
2026-03-02,Rosa,65,Phone bill,shop,phone,yes
2026-03-05,Dan,800,Rent,able,rent,yes
2026-03-09,Aunt June,40,Card with cash,person,other,no
2026-03-14,Priya,150,Groceries,shop,food,no
2026-03-20,Uncle Joe,250,Spring gift,person,other,no
2026-03-28,Rosa,90,Therapy co-pay,shop,medical,no
`;

const PAID_TO: Record<string, Delivery> = { person: "cash", cash: "cash", her: "cash", shop: "vendor", vendor: "vendor", store: "vendor", able: "able", item: "item" };

const NUMBER_HINT = "Type the amount as a number, like 1000";

/** Today in US Pacific time, YYYY-MM-DD: the same day the gift page and the home page's Gift Checker price a gift. */
const todayPacific = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
const noSubscribeToday = () => () => {};
/** The day of the build (next.config.ts): the static page paints with it, then the browser's own today takes over. */
const BUILD_DAY = process.env.NEXT_PUBLIC_BUILD_DAY || "2026-11-08";

type MoneyKey = "otherUnearnedMonthly" | "earnedMonthly" | "savings";
const MONEY_FIELDS: { key: MoneyKey; label: string }[] = [
  { key: "otherUnearnedMonthly", label: "Other monthly income, not from work" },
  { key: "earnedMonthly", label: "Monthly pay from work" },
  { key: "savings", label: "Savings now" },
];

/**
 * Her situation, kept as typed: the three money fields hold their text, so "1,240" stays on screen while she types,
 * and `valid` is false while any of them has text with no number in it.
 */
function useProfileForm() {
  const [flags, setFlags] = useState<Profile>(DEFAULT_PROFILE);
  const [money, setMoney] = useState<Record<MoneyKey, string>>(() => ({
    otherUnearnedMonthly: String(DEFAULT_PROFILE.otherUnearnedMonthly),
    earnedMonthly: String(DEFAULT_PROFILE.earnedMonthly),
    savings: String(DEFAULT_PROFILE.savings),
  }));
  const other = parseOptionalDollars(money.otherUnearnedMonthly);
  const earned = parseOptionalDollars(money.earnedMonthly);
  const savings = parseOptionalDollars(money.savings);
  const profile = useMemo<Profile>(() => ({ ...flags, otherUnearnedMonthly: other ?? 0, earnedMonthly: earned ?? 0, savings: savings ?? 0 }), [flags, other, earned, savings]);
  return { profile, valid: other !== null && earned !== null && savings !== null, flags, setFlags, money, setMoney };
}

type ProfileForm = ReturnType<typeof useProfileForm>;

function ProfileFields({ form, idPrefix }: { form: ProfileForm; idPrefix: string }) {
  const { flags, setFlags, money, setMoney } = form;
  return (
    <fieldset className="try-fieldset">
      <legend className="try-legend">
        Her situation <Info id="try.profile" label="" />
      </legend>
      <label className="try-check">
        <input type="checkbox" checked={flags.livesInAnothersHousehold} onChange={(e) => setFlags({ ...flags, livesInAnothersHousehold: e.target.checked })} />
        Lives in someone else&rsquo;s home and does not pay a share of housing
      </label>
      <label className="try-check">
        <input type="checkbox" checked={flags.couple} onChange={(e) => setFlags({ ...flags, couple: e.target.checked })} />
        Married, and both receive SSI
      </label>
      <label className="try-check">
        <input type="checkbox" checked={flags.ableEligible} onChange={(e) => setFlags({ ...flags, ableEligible: e.target.checked })} />
        Disability began before age 46 (can have an ABLE account)
      </label>
      <div className="try-row try-row-top">
        {MONEY_FIELDS.map(({ key, label }) => {
          const id = `${idPrefix}-${key}`;
          const bad = parseOptionalDollars(money[key]) === null;
          return (
            <div key={key} className="try-field">
              <label htmlFor={id}>{label}</label>
              <input
                id={id}
                inputMode="decimal"
                value={money[key]}
                onChange={(e) => setMoney({ ...money, [key]: e.target.value })}
                aria-invalid={bad || undefined}
                aria-describedby={bad ? `${id}-note` : undefined}
              />
              {bad && (
                <p id={`${id}-note`} className="try-note" data-tone="attention">
                  {NUMBER_HINT}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Where the result sits until every amount reads as a number: a quiet card in the same place, never a $0 answer. */
function ResultWaiting() {
  return (
    <div className="result-card try-wait" data-ui role="status">
      <p className="result-title">Her check shows here</p>
      <p className="muted">Once each amount is a number, the result appears in this spot.</p>
    </div>
  );
}

function DescribeTab() {
  const form = useProfileForm();
  const { profile } = form;
  const [amount, setAmount] = useState("300");
  const [category, setCategory] = useState<Category>("other");
  const [delivery, setDelivery] = useState<Delivery>("cash");
  const [recurring, setRecurring] = useState(false);
  // The gift arrives today unless the visitor picks a date, so the check it names is the one the gift page names.
  const today = useSyncExternalStore(noSubscribeToday, todayPacific, () => BUILD_DAY);
  const [picked, setDate] = useState<string | null>(null);
  const date = picked ?? today;
  const dollars = parseDollars(amount);
  const valid = form.valid;
  const result = useMemo(
    () => (dollars !== null && valid ? evaluateGift({ id: "try", date, amount: dollars, delivery, category, recurring, label: "Your gift" } satisfies Gift, profile) : null),
    [valid, dollars, delivery, category, recurring, date, profile],
  );

  return (
    <div className="try-split try-areas">
      <form className="try-form try-area-form" onSubmit={(e) => e.preventDefault()}>
        <div className="try-row try-row-top">
          <div className="try-field">
            <label htmlFor="try-amount">Amount in dollars</label>
            <input
              id="try-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={dollars === null || undefined}
              aria-describedby="try-amount-note"
            />
            <p id="try-amount-note" className="try-note tabular" data-tone={dollars === null ? "attention" : undefined}>
              {dollars === null ? NUMBER_HINT : `Checking ${usd(dollars)}`}
            </p>
          </div>
          <label className="try-field">
            <span>Date it arrives</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value || null)} />
          </label>
        </div>
        <label className="try-field">
          <span>What it is for</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="try-fieldset">
          <legend className="try-legend">How it reaches her</legend>
          <div className="checker-seg try-seg">
            {DELIVERIES.map((d) => (
              <label key={d.value} className="checker-seg-opt" data-on={delivery === d.value ? "" : undefined}>
                <input type="radio" name="try-delivery" value={d.value} checked={delivery === d.value} onChange={() => setDelivery(d.value)} />
                {d.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="try-check">
          <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
          The same person gives this every month
        </label>
      </form>
      <div className="try-area-result">{result ? <ResultCard result={result} /> : <ResultWaiting />}</div>
      <div className="try-area-profile">
        <ProfileFields form={form} idPrefix="try-describe" />
      </div>
    </div>
  );
}

type Row = { date: string; giver: string; amount: string; description: string; paid_to: string; category: string; recurring: string };

function MonthTab() {
  const [csv, setCsv] = useState(CSV_TEMPLATE);
  const form = useProfileForm();
  const { profile } = form;
  const parsed = useMemo(() => {
    const out = Papa.parse<Row>(csv.trim(), { header: true, skipEmptyLines: true });
    const gifts: Gift[] = [];
    const problems: string[] = [];
    out.data.slice(0, 500).forEach((r, i) => {
      const amount = parseDollars(String(r.amount ?? ""));
      const delivery = PAID_TO[String(r.paid_to ?? "").trim().toLowerCase()];
      const category = (CATEGORIES.find((c) => c.value === String(r.category ?? "").trim().toLowerCase())?.value ?? "other") as Category;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.date ?? "").trim())) problems.push(`Row ${i + 2}: the date should look like 2026-03-14.`);
      else if (!amount) problems.push(`Row ${i + 2}: the amount is missing.`);
      else if (!delivery) problems.push(`Row ${i + 2}: paid_to should be person, shop, item or able.`);
      else
        gifts.push({
          id: `row${i}`,
          date: r.date.trim(),
          amount,
          delivery,
          category,
          giver: r.giver?.trim(),
          label: r.description?.trim(),
          recurring: /^(y|yes|true|1)$/i.test(String(r.recurring ?? "").trim()),
        });
    });
    return { gifts, problems };
  }, [csv]);
  const plan = useMemo(() => (parsed.gifts.length && form.valid ? planMonths(parsed.gifts, profile) : null), [parsed.gifts, profile, form.valid]);

  return (
    <div className="try-split try-areas">
      <div className="try-form try-area-form">
        <label className="try-field">
          <span>Gifts as CSV (edit here, or upload a file)</span>
          <textarea rows={9} value={csv} onChange={(e) => setCsv(e.target.value)} spellCheck={false} />
        </label>
        <div className="try-actions">
          <label className="btn btn-quiet try-upload">
            Upload a CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setCsv(await f.text());
              }}
            />
          </label>
          <a className="text-link" href={`data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}`} download="giftwise-month-template.csv">
            Download the template
          </a>
        </div>
        {parsed.problems.length > 0 && (
          <ul className="try-problems">
            {parsed.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </div>
      {!form.valid && (
        <div className="try-area-result">
          <ResultWaiting />
        </div>
      )}
      <div className="month-results try-area-result" data-ui hidden={!form.valid}>
        {plan?.months.map((m) => (
          <div key={m.month} className="month-row">
            <p className="month-name">
              {monthName(m.month)} gifts, counted for the {checkMonthName(m.paymentMonth)} check
            </p>
            <p className="month-check tabular" data-kept={m.check >= fbr(false, m.paymentMonth) ? "" : undefined}>
              {usd(m.check)}
            </p>
            <p className="month-detail tabular">
              Counted {usd(m.countableIncome)}. One-off exclusion {usd(m.infrequentExcluded)}, general exclusion {usd(m.generalExcludedFromUnearned)}. Savings on the next 1st:{" "}
              {usd(m.savingsOnNextFirst)}
              {m.overResourceLimit ? ", over the limit" : ""}.
            </p>
          </div>
        ))}
        <ul className="month-gifts">
          {plan?.gifts.map((r) => (
            <li key={r.gift.id} className="month-gift">
              <span>
                {r.gift.label ?? "Gift"} <span className="muted">from {r.gift.giver ?? "someone"}</span>
              </span>
              <span className="tabular">{usd(r.gift.amount)}</span>
              <span className="month-gift-note">{r.countedAmount > 0 && r.checkWithBestRoute > r.checkAfter ? `Better: ${r.bestRoute === "item" ? "give the item" : r.bestRoute === "vendor" ? "pay the shop" : "send to ABLE"}` : r.countedAmount > 0 ? "Counted" : "Not counted"}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="try-area-profile">
        <ProfileFields form={form} idPrefix="try-month" />
      </div>
    </div>
  );
}

/** How a run was answered, from the response's meta: the model, and whether Claude's recorded answer was replayed. */
type RunMeta = { model?: string; replayed?: boolean; recorded_at?: string; review_replayed?: boolean };
/** The sample electric bill, and how the two reviewers are asked about it (the API docs' example, src/lib/ai/replay-set.ts). */
const SAMPLE_BILL_PNG = "/samples/northside-electric-bill.png";
const SAMPLE_REVIEW = { date: "2026-04-10", ...(ENDPOINTS.find((e) => e.id === "review-bill")!.example as Omit<ReviewInput, "date">) } as ReviewInput;
type SampleRun = { read: SampleRead; review: ReviewData | null; reviewMeta: RunMeta; reviewNote?: string };

function AiTab({ kind }: { kind: "bill" | "fundraiser" }) {
  const [state, setState] = useState<{ status: "idle" | "working" | "done" | "unavailable" | "error"; message?: string; data?: unknown; meta?: RunMeta; sample?: SampleRun }>({ status: "idle" });
  const [runs, setRuns] = useState(0);
  const [url, setUrl] = useState("");
  // "Start a gift page" on the home page asks who it is for and passes it as ?name=, so the page it makes starts with that name.
  // This tab only renders in the browser (the open tab comes from the address), so reading the address here is safe.
  const [forName] = useState(() => (typeof window === "undefined" ? "" : (new URLSearchParams(window.location.search).get("name") ?? "").trim().slice(0, 40)));
  async function run(body: FormData | string) {
    setState({ status: "working" });
    try {
      const res = await fetch(kind === "bill" ? "/api/v1/read-bill" : "/api/v1/analyze-fundraiser", {
        method: "POST",
        body,
        headers: typeof body === "string" ? { "Content-Type": "application/json" } : undefined,
      });
      const json = await res.json();
      if (res.status === 503) setState({ status: "unavailable", message: json.error?.message });
      else if (!res.ok) setState({ status: "error", message: json.error?.message ?? "Something went wrong. Please try again." });
      else setState({ status: "done", data: json.data, meta: json.meta });
    } catch {
      setState({ status: "error", message: "Could not reach Giftwise. Check your connection and try again." });
    }
    setRuns((n) => n + 1);
  }
  // The sample bill end to end: Claude reads it (the live step on its example page), and the two reviewers answer on it.
  // Live within the day's budget; otherwise Claude's recorded answers, replayed through the same code.
  async function runSample() {
    setState({ status: "working" });
    try {
      const [read, review] = await Promise.all([
        fetch("/api/live/sample-bill", { method: "POST" }).then((r) => r.json()),
        fetch("/api/v1/review-bill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(SAMPLE_REVIEW) }).then(async (r) => ({ ok: r.ok, json: await r.json() })),
      ]);
      if (!read.data) throw new Error();
      setState({
        status: "done",
        sample: { read: read.data as SampleRead, review: review.ok ? (review.json.data as ReviewData) : null, reviewMeta: review.json.meta ?? {}, reviewNote: review.ok ? undefined : review.json.error?.message },
      });
    } catch {
      setState({ status: "error", message: "Could not reach Giftwise. Check your connection and try again." });
    }
    setRuns((n) => n + 1);
  }
  return (
    <div className="try-split">
      <div className="try-form">
        {kind === "bill" ? (
          <label className="try-drop">
            <span className="try-drop-title">Upload or photograph a bill or quote</span>
            <span className="muted">Photo or PDF, up to 10 MB. On a phone this opens the camera.</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const fd = new FormData();
                fd.append("file", f);
                run(fd);
              }}
            />
          </label>
        ) : null}
        {kind === "bill" && (
          <div className="try-sample">
            <button type="button" className="btn btn-quiet" onClick={runSample} disabled={state.status === "working"}>
              Use the sample electric bill
            </button>
            <a className="text-link" href={SAMPLE_BILL_PNG} target="_blank" rel="noreferrer">
              See the bill
            </a>
          </div>
        )}
        {kind === "bill" ? null : (
          <form
            className="try-row"
            onSubmit={(e) => {
              e.preventDefault();
              run(JSON.stringify({ url }));
            }}
          >
            <p className="try-lede try-grow">
              Giftwise builds {forName ? `${forName}’s` : "the"} gift page from a fundraiser&rsquo;s list of needs. Paste its link, or start from the sample.
            </p>
            <label className="try-field try-grow">
              <span>Link to a public fundraising page</span>
              <input type="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} required />
            </label>
            {/* With the field still empty, the sample is the step to take; once a link is typed, checking it is. */}
            <div className="try-actions try-grow">
              <button type="submit" className={`btn ${url.trim() ? "btn-primary" : "btn-quiet"} try-go`}>
                Check it
              </button>
              <button
                type="button"
                className={`btn ${url.trim() ? "btn-quiet" : "btn-primary"} try-go`}
                onClick={() => {
                  const sample = `${window.location.origin}/samples/fundraiser.html`;
                  setUrl(sample);
                  run(JSON.stringify({ url: sample }));
                }}
              >
                Use the sample fundraiser
              </button>
            </div>
          </form>
        )}
        <AiBudget refresh={runs} />
        <p className="muted try-privacy">What you upload is used only to show your result and is deleted within 7 days.</p>
      </div>
      <div className="ai-state" aria-live="polite">
        {state.status === "idle" && <p className="muted">Your result appears here. You can also open the {kind === "bill" ? "Wheelchair repair or Electric bill" : "Accessible van fundraiser"} example on the right.</p>}
        {state.status === "working" && <p>{kind === "bill" ? "Reading the bill and checking the rule. A bill near housing also goes to the two reviewers, about 20 seconds more…" : "Reading the page and planning each use…"}</p>}
        {state.status === "unavailable" && (
          <p className="result-attention">{state.message ?? "The live AI service is not connected on this server yet. The ready-made examples show the full result."}</p>
        )}
        {state.status === "error" && <p className="result-attention">{state.message}</p>}
        {state.status === "done" && state.sample && <SampleBillResult run={state.sample} />}
        {state.status === "done" && !state.sample && kind === "bill" && <BillResult data={state.data as BillData} meta={state.meta ?? {}} />}
        {state.status === "done" && kind === "fundraiser" && <FundraiserResult data={state.data as FundraiserData} url={url} forName={forName} meta={state.meta ?? {}} />}
      </div>
    </div>
  );
}

type BillData = {
  bill: {
    vendor_name: string;
    vendor_category: Category;
    amount_due: number;
    due_date: string | null;
    is_shelter_cost: boolean;
    confidence: number;
    line_items: { description: string; amount: number }[];
    explanation: { plain: string; technical: string };
  };
  /** How Giftwise pays it: on the one reading, or after the two reviewers (sent by servers since the reviewers joined bill reading). */
  route?: { delivery: "vendor" | "able" | null; check_after: number | null; decided_by: "reading" | "reviewers" | "both_readings"; readings: Category[]; reviewed_because: string[]; note: string | null };
  review?: ReviewData | null;
};

const when = (iso: string) => new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" });
/** The line under "What Claude read": live, or Claude's recorded reading replayed through the same reader. */
function ReadMode({ meta }: { meta: RunMeta }) {
  if (!meta.replayed) return null;
  return <p className="read-mode muted">Replayed: {modelName(meta.model)}&rsquo;s recorded reading{meta.recorded_at ? ` of ${when(meta.recorded_at)}` : ""}, run just now through the same reader and rules engine.</p>;
}

/** The sample bill: what Claude read, the engine's answer for paying it, and the two reviewers with the referee's verdict. */
function SampleBillResult({ run }: { run: SampleRun }) {
  const r = run.read;
  const input = SAMPLE_REVIEW;
  return (
    <div className="ai-result">
      <div className="read-card" data-ui>
        <p className="result-k">What Claude read</p>
        <ReadMode meta={{ model: r.model, replayed: r.mode !== "live", recorded_at: r.mode !== "live" ? r.read_at : undefined }} />
        <dl className="read-fields">
          <div>
            <dt>From</dt>
            <dd>{r.bill.vendor_name}</dd>
          </div>
          <div>
            <dt>Amount</dt>
            <dd className="tabular">{usd(r.bill.amount_due)}</dd>
          </div>
          <div>
            <dt>Due</dt>
            <dd>{r.bill.due_date ?? "Not shown"}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{r.bill.is_shelter_cost ? "Housing cost (utility, rent or similar)" : CATEGORIES.find((c) => c.value === r.bill.vendor_category)?.label}</dd>
          </div>
        </dl>
        <p className="read-plain">{r.bill.explanation.plain}</p>
        <p className="read-plain">
          Paid to the company, her {r.check.month} check would be <span className="tabular">{usd(r.check.paid_to_company)}</span>; through her ABLE account it stays{" "}
          <span className="tabular">{usd(r.check.through_able)}</span>.
        </p>
      </div>
      {run.review ? (
        <ReviewPanel input={input} ran={{ data: run.review, source: run.reviewMeta.replayed ? replayedSource(run.reviewMeta) : `Run live just now with ${modelName(run.reviewMeta.model)}.` }} />
      ) : (
        <>
          {run.reviewNote && <p className="result-attention">{run.reviewNote}</p>}
          <ReviewPanel input={input} />
        </>
      )}
    </div>
  );
}

/** What Claude read, side by side with the engine's answer for paying that bill, and the two reviewers when the bill is near housing. */
function BillResult({ data, meta }: { data: BillData; meta: RunMeta }) {
  const model = meta.model;
  const { prefs } = usePrefs();
  const b = data.bill;
  // The reading the route rests on: the referee's when the reviewers ran (the worse one when it was unsure), else Claude's.
  const category = data.route?.readings[0] ?? b.vendor_category;
  const result = evaluateGift(
    { id: "bill", date: b.due_date ?? "2026-11-20", amount: b.amount_due, delivery: "vendor", category, label: `Pay ${b.vendor_name}` },
    DEFAULT_PROFILE,
  );
  const input = { description: billDescription(b), amount: b.amount_due, category: b.vendor_category, date: result.gift.date };
  const asked = data.route?.reviewed_because.length ? `Asked automatically. ${data.route.reviewed_because.join(" ")} ` : "";
  return (
    <div className="ai-result">
      <div className="read-card" data-ui>
        <p className="result-k">What Claude read</p>
        <ReadMode meta={meta} />
        <dl className="read-fields">
          <div>
            <dt>From</dt>
            <dd>{b.vendor_name}</dd>
          </div>
          <div>
            <dt>Amount</dt>
            <dd className="tabular">{usd(b.amount_due)}</dd>
          </div>
          <div>
            <dt>Due</dt>
            <dd>{b.due_date ?? "Not shown"}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{b.is_shelter_cost ? "Housing cost (utility, rent or similar)" : CATEGORIES.find((c) => c.value === b.vendor_category)?.label}</dd>
          </div>
        </dl>
        <p className="read-plain">{b.explanation.plain}</p>
        {prefs.mode === "technical" && <p className="result-tech">{b.explanation.technical} Confidence {Math.round(b.confidence * 100)}%.</p>}
      </div>
      <ResultCard result={result} title={`If someone pays ${b.vendor_name}`} />
      {data.review ? (
        <ReviewPanel input={input} ran={{ data: data.review, source: meta.review_replayed ? `${asked}${replayedSource(meta)}` : `${asked}Run live just now with ${modelName(model)}.` }} />
      ) : data.route?.decided_by === "both_readings" ? (
        <>
          {data.route.note && <p className="result-attention">{data.route.note}</p>}
          <ReviewPanel input={input} />
        </>
      ) : (
        result.ambiguous && result.treatment.kind === "ism_shelter" && <ReviewPanel input={input} />
      )}
    </div>
  );
}

type FundraiserData = {
  page: { title: string; read_via: string; live_view_url: string | null };
  fundraiser: { raised_amount: number | null; goal_amount: number | null };
  plan: { use: string; amount: number; category: Category; likely_vendor: string | null; route: Delivery; check_if_cash: number; check_with_route: number }[];
  summary: string;
};

const ROUTE_WORDS: Record<string, string> = { vendor: "Pay the shop", item: "Give the item", able: "To her ABLE account", cash: "Cash" };

function FundraiserResult({ data, url, forName, meta }: { data: FundraiserData; url: string; forName: string; meta: RunMeta }) {
  const { prefs } = usePrefs();
  return (
    <div className="ai-result">
      <div className="read-card" data-ui>
        <p className="result-k">{data.page.title}</p>
        <ReadMode meta={meta} />
        <p className="read-summary">{data.summary}</p>
        <ul className="month-gifts">
          {data.plan.map((p) => (
            <li key={p.use} className="month-gift">
              <span>{p.use}</span>
              <span className="tabular">{usd(p.amount)}</span>
              <span className="month-gift-note">
                {ROUTE_WORDS[p.route]}: her check stays {usd(p.check_with_route)}. As cash it would be {usd(p.check_if_cash)}.
              </span>
            </li>
          ))}
        </ul>
        {prefs.mode === "technical" && (
          <p className="result-tech">
            Page read with {data.page.read_via === "kernel" ? "a KERNEL cloud browser" : data.page.read_via === "bundled" ? "the copy this site ships" : "a direct fetch"}; uses extracted by Claude; routes from the rules engine.
            {data.page.live_view_url ? ` Live view: ${data.page.live_view_url}` : ""}
          </p>
        )}
      </div>
      <MakeGiftPage uses={data.plan.map((p) => ({ use: p.use, amount: p.amount, category: p.category, likely_vendor: p.likely_vendor }))} sourceUrl={url} initialName={forName} />
    </div>
  );
}

const TABS = [
  { id: "describe", label: "Describe a gift", info: "try.describe" },
  { id: "month", label: "A month of gifts", info: "try.csv" },
  { id: "bill", label: "A bill or quote", info: "try.bill" },
  { id: "fundraiser", label: "A fundraiser page", info: "try.fundraiser" },
] as const;

type TabId = (typeof TABS)[number]["id"];
/** The open tab lives in the address (#fundraiser), so a link can open a tab and the back button keeps it. */
const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const readHash = () => window.location.hash.slice(1);

export function TryTabs() {
  const hash = useSyncExternalStore(subscribeHash, readHash, () => "");
  const tab: TabId = TABS.some((t) => t.id === hash) ? (hash as TabId) : "describe";
  const setTab = (id: TabId) => {
    // Keep ?name= from "Start a gift page", so the fundraiser tab can still use it after switching tabs.
    window.history.replaceState(null, "", `${window.location.search}#${id}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };
  // Arriving at a tab from a link elsewhere (Start a gift page opens #fundraiser) can keep the old page's scroll,
  // since no element carries that id. Bring the tabs into view: from the top when they fit there, else at the tabs.
  useEffect(() => {
    if (!TABS.some((t) => `#${t.id}` === window.location.hash)) return;
    const tabs = document.querySelector<HTMLElement>(".try-tabs");
    if (!tabs) return;
    const top = tabs.getBoundingClientRect().top;
    if (top >= 0 && top < window.innerHeight * 0.6) return;
    const fromTop = top + window.scrollY;
    if (fromTop < window.innerHeight * 0.5) window.scrollTo({ top: 0 });
    else tabs.scrollIntoView({ block: "start" });
  }, []);
  // The tab pattern: one tab stop for the whole row, then Left, Right, Home and End move between tabs (and open them).
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const next = e.key === "ArrowRight" ? (i + 1) % TABS.length : e.key === "ArrowLeft" ? (i - 1 + TABS.length) % TABS.length : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    setTab(TABS[next].id);
    document.getElementById(`tab-${TABS[next].id}`)?.focus();
  };
  return (
    <div className="try-tabs">
      <div className="tabbar">
        <div className="tablist" role="tablist" aria-label="Ways to try Giftwise" onKeyDown={onKeyDown}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              className="tab"
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Info id={TABS.find((t) => t.id === tab)!.info} />
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tabpanel">
        {tab === "describe" && <DescribeTab />}
        {tab === "month" && <MonthTab />}
        {tab === "bill" && <AiTab kind="bill" />}
        {tab === "fundraiser" && <AiTab kind="fundraiser" />}
      </div>
    </div>
  );
}
