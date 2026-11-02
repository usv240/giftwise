"use client";

import Papa from "papaparse";
import { useMemo, useState } from "react";
import { Info } from "../Info";
import { ResultCard } from "../ResultCard";
import { MakeGiftPage } from "./MakeGiftPage";
import { ReviewPanel } from "./ReviewPanel";
import { usePrefs } from "../prefs";
import { DEFAULT_PROFILE, evaluateGift, monthName, planMonths, usd, type Category, type Delivery, type Gift, type Profile } from "@/lib/rules";

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

function ProfileFields({ profile, onChange }: { profile: Profile; onChange: (p: Profile) => void }) {
  return (
    <fieldset className="try-fieldset">
      <legend className="try-legend">
        Her situation <Info id="try.profile" label="" />
      </legend>
      <label className="try-check">
        <input type="checkbox" checked={profile.livesInAnothersHousehold} onChange={(e) => onChange({ ...profile, livesInAnothersHousehold: e.target.checked })} />
        Lives in someone else&rsquo;s home and does not pay a share of housing
      </label>
      <label className="try-check">
        <input type="checkbox" checked={profile.couple} onChange={(e) => onChange({ ...profile, couple: e.target.checked })} />
        Married, and both receive SSI
      </label>
      <label className="try-check">
        <input type="checkbox" checked={profile.ableEligible} onChange={(e) => onChange({ ...profile, ableEligible: e.target.checked })} />
        Disability began before age 46 (can have an ABLE account)
      </label>
      <div className="try-row">
        <label className="try-field">
          <span>Other monthly income, not from work</span>
          <input inputMode="decimal" value={profile.otherUnearnedMonthly} onChange={(e) => onChange({ ...profile, otherUnearnedMonthly: Number(e.target.value) || 0 })} />
        </label>
        <label className="try-field">
          <span>Monthly pay from work</span>
          <input inputMode="decimal" value={profile.earnedMonthly} onChange={(e) => onChange({ ...profile, earnedMonthly: Number(e.target.value) || 0 })} />
        </label>
        <label className="try-field">
          <span>Savings now</span>
          <input inputMode="decimal" value={profile.savings} onChange={(e) => onChange({ ...profile, savings: Number(e.target.value) || 0 })} />
        </label>
      </div>
    </fieldset>
  );
}

function DescribeTab() {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [amount, setAmount] = useState("300");
  const [category, setCategory] = useState<Category>("other");
  const [delivery, setDelivery] = useState<Delivery>("cash");
  const [recurring, setRecurring] = useState(false);
  const [date, setDate] = useState("2026-04-10");
  const gift: Gift = { id: "try", date, amount: Number(amount) || 0, delivery, category, recurring, label: "Your gift" };
  const result = useMemo(() => evaluateGift(gift, profile), [gift.amount, gift.delivery, gift.category, gift.recurring, gift.date, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="try-split">
      <form className="try-form" onSubmit={(e) => e.preventDefault()}>
        <div className="try-row">
          <label className="try-field">
            <span>Amount in dollars</span>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="try-field">
            <span>Date it arrives</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value || "2026-04-10")} />
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
        <ProfileFields profile={profile} onChange={setProfile} />
      </form>
      <ResultCard result={result} />
    </div>
  );
}

type Row = { date: string; giver: string; amount: string; description: string; paid_to: string; category: string; recurring: string };

function MonthTab() {
  const [csv, setCsv] = useState(CSV_TEMPLATE);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const parsed = useMemo(() => {
    const out = Papa.parse<Row>(csv.trim(), { header: true, skipEmptyLines: true });
    const gifts: Gift[] = [];
    const problems: string[] = [];
    out.data.slice(0, 500).forEach((r, i) => {
      const amount = Number(String(r.amount ?? "").replace(/[^0-9.]/g, ""));
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
  const plan = useMemo(() => (parsed.gifts.length ? planMonths(parsed.gifts, profile) : null), [parsed.gifts, profile]);

  return (
    <div className="try-split">
      <div className="try-form">
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
        <ProfileFields profile={profile} onChange={setProfile} />
      </div>
      <div className="month-results" data-ui>
        {plan?.months.map((m) => (
          <div key={m.month} className="month-row">
            <p className="month-name">
              {monthName(m.month)} gifts, counted for the {monthName(m.paymentMonth)} check
            </p>
            <p className="month-check tabular" data-kept={m.check >= 994 ? "" : undefined}>
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
    </div>
  );
}

function AiTab({ kind }: { kind: "bill" | "fundraiser" }) {
  const [state, setState] = useState<{ status: "idle" | "working" | "done" | "unavailable" | "error"; message?: string; data?: unknown }>({ status: "idle" });
  const [url, setUrl] = useState("");
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
      else setState({ status: "done", data: json.data });
    } catch {
      setState({ status: "error", message: "Could not reach Giftwise. Check your connection and try again." });
    }
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
        ) : (
          <form
            className="try-row"
            onSubmit={(e) => {
              e.preventDefault();
              run(JSON.stringify({ url }));
            }}
          >
            <label className="try-field try-grow">
              <span>Link to a public fundraising page</span>
              <input type="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} required />
            </label>
            <button type="submit" className="btn btn-primary try-go">
              Check it
            </button>
            <button
              type="button"
              className="btn btn-quiet try-go"
              onClick={() => {
                const sample = `${window.location.origin}/samples/fundraiser.html`;
                setUrl(sample);
                run(JSON.stringify({ url: sample }));
              }}
            >
              Use the sample fundraiser
            </button>
          </form>
        )}
        <p className="muted try-privacy">What you upload is used only to show your result and is deleted within 7 days.</p>
      </div>
      <div className="ai-state" aria-live="polite">
        {state.status === "idle" && <p className="muted">Your result appears here. You can also open the {kind === "bill" ? "Wheelchair repair or Electric bill" : "Accessible van fundraiser"} example on the right.</p>}
        {state.status === "working" && <p>{kind === "bill" ? "Reading the bill and checking the rule…" : "Reading the page and planning each use…"}</p>}
        {state.status === "unavailable" && (
          <p className="result-attention">{state.message ?? "The live AI service is not connected on this server yet. The ready-made examples show the full result."}</p>
        )}
        {state.status === "error" && <p className="result-attention">{state.message}</p>}
        {state.status === "done" && kind === "bill" && <BillResult data={state.data as BillData} />}
        {state.status === "done" && kind === "fundraiser" && <FundraiserResult data={state.data as FundraiserData} url={url} />}
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
};

/** What Claude read, side by side with the engine's answer for paying that bill. */
function BillResult({ data }: { data: BillData }) {
  const { prefs } = usePrefs();
  const b = data.bill;
  const result = evaluateGift(
    { id: "bill", date: b.due_date ?? "2026-11-20", amount: b.amount_due, delivery: "vendor", category: b.vendor_category, label: `Pay ${b.vendor_name}` },
    DEFAULT_PROFILE,
  );
  return (
    <div className="ai-result">
      <div className="read-card" data-ui>
        <p className="result-k">What Claude read</p>
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
      {result.ambiguous && result.treatment.kind === "ism_shelter" && (
        <ReviewPanel
          input={{
            description: [`${b.vendor_name}.`, ...(b.line_items ?? []).map((l) => `${l.description}: ${usd(l.amount)}`)].join(" "),
            amount: b.amount_due,
            category: b.vendor_category,
            date: result.gift.date,
          }}
        />
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

function FundraiserResult({ data, url }: { data: FundraiserData; url: string }) {
  const { prefs } = usePrefs();
  return (
    <div className="ai-result">
      <div className="read-card" data-ui>
        <p className="result-k">{data.page.title}</p>
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
            Page read with {data.page.read_via === "kernel" ? "a KERNEL cloud browser" : "a direct fetch"}; uses extracted by Claude; routes from the rules engine.
            {data.page.live_view_url ? ` Live view: ${data.page.live_view_url}` : ""}
          </p>
        )}
      </div>
      <MakeGiftPage uses={data.plan.map((p) => ({ use: p.use, amount: p.amount, category: p.category, likely_vendor: p.likely_vendor }))} sourceUrl={url} />
    </div>
  );
}

const TABS = [
  { id: "describe", label: "Describe a gift", info: "try.describe" },
  { id: "month", label: "A month of gifts", info: "try.csv" },
  { id: "bill", label: "A bill or quote", info: "try.bill" },
  { id: "fundraiser", label: "A fundraiser page", info: "try.fundraiser" },
] as const;

export function TryTabs() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("describe");
  return (
    <div className="try-tabs">
      <div className="tabbar">
        <div className="tablist" role="tablist" aria-label="Ways to try Giftwise">
          {TABS.map((t) => (
            <button key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} className="tab" onClick={() => setTab(t.id)}>
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
