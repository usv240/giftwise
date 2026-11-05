"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { usd } from "@/lib/rules";

export type ManageNeed = {
  id: number;
  title: string;
  detail: string;
  category: string;
  route: string;
  paidTo: string;
  amount: number;
  funded: number;
  status: string;
  recurring: boolean;
  rule: string;
  removable: boolean;
};

/** The categories an organizer picks from, in plain words. Housing ones go to the ABLE account by rule. */
export const CATEGORIES: [string, string][] = [
  ["equipment", "Equipment, such as a wheelchair repair"],
  ["medical", "Medical care, therapy or medicine"],
  ["education", "School: tuition, books, a laptop"],
  ["transport", "Transport: rides, bus pass, car repair"],
  ["phone", "Phone bill"],
  ["internet", "Internet bill"],
  ["clothing", "Clothing"],
  ["personal", "Personal items"],
  ["food", "Food"],
  ["event", "Tickets to an event"],
  ["utility", "Utility bill (housing: goes to ABLE)"],
  ["rent", "Rent (housing: goes to ABLE)"],
  ["mortgage", "Mortgage (housing: goes to ABLE)"],
  ["property_tax", "Property tax (housing: goes to ABLE)"],
  ["other", "Something else"],
];
const HOUSING = new Set(["utility", "rent", "mortgage", "property_tax"]);

async function send(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message ?? "That did not work. Please try again.");
  return j.data;
}

type Draft = { title: string; detail: string; amount: string; category: string; vendor: string; recurring: boolean };
const empty: Draft = { title: "", detail: "", amount: "", category: "equipment", vendor: "", recurring: false };

function NeedForm({ initial, submitLabel, onSubmit, onCancel }: { initial: Draft; submitLabel: string; onSubmit: (d: Draft) => Promise<void>; onCancel?: () => void }) {
  const [d, setD] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const housing = HOUSING.has(d.category);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  return (
    <form
      className="mg-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setNote("");
        try {
          await onSubmit(d);
        } catch (err) {
          setNote((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="mg-field mg-wide">
        <span>What it is for</span>
        <input value={d.title} onChange={(e) => set("title", e.target.value)} required minLength={2} maxLength={80} placeholder="Wheelchair repair" />
      </label>
      <label className="mg-field">
        <span>Amount still needed</span>
        <input value={d.amount} onChange={(e) => set("amount", e.target.value)} inputMode="decimal" required placeholder="420" />
      </label>
      <label className="mg-field">
        <span>Category</span>
        <select value={d.category} onChange={(e) => set("category", e.target.value)}>
          {CATEGORIES.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="mg-field mg-wide">
        <span>{housing ? "Paid to" : "Who is paid: the shop, clinic or school"}</span>
        <input value={housing ? "The ABLE account (housing always goes there)" : d.vendor} onChange={(e) => set("vendor", e.target.value)} disabled={housing} maxLength={80} placeholder="Riverside Mobility Repair" />
      </label>
      <label className="mg-field mg-wide">
        <span>A line for givers (optional)</span>
        <input value={d.detail} onChange={(e) => set("detail", e.target.value)} maxLength={200} placeholder="New push rims and a brake adjustment." />
      </label>
      <label className="mg-check">
        <input type="checkbox" checked={d.recurring} onChange={(e) => set("recurring", e.target.checked)} /> Comes back every month
      </label>
      <div className="mg-form-actions">
        <button type="submit" className="btn btn-ink" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
        <span className="mg-note" role="status">
          {note}
        </span>
      </div>
    </form>
  );
}

const toBody = (d: Draft) => ({
  title: d.title,
  detail: d.detail || undefined,
  amount: Number(d.amount.replace(/[^0-9.]/g, "")),
  category: d.category,
  vendor: d.vendor || null,
  recurring: d.recurring,
});

export function ManageNeeds({ token, needs }: { token: string; needs: ManageNeed[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState("");
  const base = `/api/manage/${encodeURIComponent(token)}`;
  return (
    <div className="mg-needs">
      <ul className="mg-list">
        {needs.map((n) => (
          <li key={n.id} className="mg-need" data-ui>
            {editing === n.id ? (
              <NeedForm
                initial={{ title: n.title, detail: n.detail, amount: String(n.amount), category: n.category, vendor: n.route === "able" ? "" : n.paidTo, recurring: n.recurring }}
                submitLabel="Save"
                onCancel={() => setEditing(null)}
                onSubmit={async (d) => {
                  await send(`${base}/needs/${n.id}`, "PATCH", toBody(d));
                  setEditing(null);
                  router.refresh();
                }}
              />
            ) : (
              <>
                <div className="mg-need-main">
                  <p className="mg-need-title">{n.title}</p>
                  <p className="mg-need-to">
                    Paid straight to <strong>{n.paidTo}</strong>
                  </p>
                  <p className="mg-need-rule">{n.rule}</p>
                </div>
                <div className="mg-need-side">
                  <p className="mg-need-amount tabular">{usd(n.amount)}</p>
                  <p className="mg-need-funded tabular">{n.status === "paid" ? "Paid in full" : n.funded > 0 ? `${usd(n.funded)} given` : "Nothing given yet"}</p>
                  <div className="mg-need-actions">
                    <button type="button" className="mg-link" onClick={() => setEditing(n.id)}>
                      Edit
                    </button>
                    {n.removable && (
                      <button
                        type="button"
                        className="mg-link"
                        onClick={async () => {
                          setNote("");
                          try {
                            await send(`${base}/needs/${n.id}`, "DELETE");
                            router.refresh();
                          } catch (err) {
                            setNote((err as Error).message);
                          }
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      {note && (
        <p className="mg-note" role="status">
          {note}
        </p>
      )}
      {adding ? (
        <div className="mg-need" data-ui>
          <NeedForm
            initial={empty}
            submitLabel="Add the need"
            onCancel={() => setAdding(false)}
            onSubmit={async (d) => {
              await send(`${base}/needs`, "POST", toBody(d));
              setAdding(false);
              router.refresh();
            }}
          />
        </div>
      ) : (
        <button type="button" className="btn btn-ink mg-add" onClick={() => setAdding(true)}>
          Add a need
        </button>
      )}
    </div>
  );
}

export function PageStatus({ token, status, note: initialNote }: { token: string; status: string; note: string }) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const base = `/api/manage/${encodeURIComponent(token)}`;
  const run = async (body: unknown, done: string) => {
    setBusy(true);
    setMsg("");
    try {
      await send(base, "PATCH", body);
      setMsg(done);
      router.refresh();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mg-status">
      <label className="mg-field mg-wide">
        <span>Note to givers, at the top of the page</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} rows={3} />
      </label>
      <div className="mg-form-actions">
        <button type="button" className="btn btn-ink" disabled={busy} onClick={() => run({ note }, "Note saved.")}>
          Save the note
        </button>
        {status === "closed" ? (
          <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => run({ status: "open" }, "The page takes gifts again.")}>
            Reopen the page
          </button>
        ) : (
          <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => run({ status: "closed" }, "The page is closed. Its receipts stay public.")}>
            Close the page
          </button>
        )}
        <span className="mg-note" role="status">
          {msg}
        </span>
      </div>
    </div>
  );
}

export function Notifications({ token, url: initialUrl }: { token: string; url: string | null }) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [saved, setSaved] = useState<string | null>(initialUrl);
  const [secret, setSecret] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const base = `/api/manage/${encodeURIComponent(token)}/webhook`;
  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg("");
    try {
      await fn();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mg-hook">
      <label className="mg-field mg-wide">
        <span>Webhook address (https)</span>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.zapier.com/hooks/catch/…" inputMode="url" />
      </label>
      <div className="mg-form-actions">
        <button
          type="button"
          className="btn btn-ink"
          disabled={busy || !url.trim()}
          onClick={() =>
            act(async () => {
              const d = await send(base, "PUT", { url });
              setSaved(d.url);
              setSecret(d.secret);
              setMsg("Saved. Each gift is sent here as soon as PayPal completes it.");
            })
          }
        >
          Save
        </button>
        {saved && (
          <>
            <button
              type="button"
              className="btn btn-quiet"
              disabled={busy}
              onClick={() =>
                act(async () => {
                  const d = await send(base, "POST");
                  setMsg(`Test sent. The webhook answered ${d.status}.`);
                })
              }
            >
              Send a test
            </button>
            <button
              type="button"
              className="mg-link"
              disabled={busy}
              onClick={() =>
                act(async () => {
                  await send(base, "PUT", { url: null });
                  setSaved(null);
                  setUrl("");
                  setSecret(null);
                  setMsg("Removed. No more gift events are sent.");
                })
              }
            >
              Remove
            </button>
          </>
        )}
        <span className="mg-note" role="status">
          {msg}
        </span>
      </div>
      {secret && (
        <p className="mg-secret">
          Signing secret, to check each event came from Giftwise: <code>{secret}</code>
        </p>
      )}
    </div>
  );
}
