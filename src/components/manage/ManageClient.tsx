"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { usd } from "@/lib/rules";

export type ManageNeed = {
  id: number;
  title: string;
  detail: string;
  category: string;
  route: string;
  paidTo: string;
  /** The shop's own PayPal email, when the organizer set one; this page is private, so it is shown in full. */
  payeePaypal: string | null;
  /** A sample shop with its own sandbox account: its payee stays as it is. */
  fixedPayee: boolean;
  amount: number;
  funded: number;
  status: string;
  recurring: boolean;
  rule: string;
  removable: boolean;
};

/** The household's pronoun words, so every line on the page says "her", "his" or "their" the same way. */
export type Words = { subj: string; poss: string; Poss: string };

/** The categories an organizer picks from, in plain words, grouped by where Giftwise sends the money. */
const SHOP_CATEGORIES: [string, string][] = [
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
  ["other", "Something else"],
];
/** Housing always goes to the ABLE account, by rule. */
const HOUSING_CATEGORIES: [string, string][] = [
  ["utility", "Utility bill"],
  ["rent", "Rent"],
  ["mortgage", "Mortgage"],
  ["property_tax", "Property tax"],
];
const HOUSING = new Set(HOUSING_CATEGORIES.map(([v]) => v));

async function send(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message ?? "That did not work. Please try again.");
  return j.data;
}

/** "$420", "420.00" and "1,200" all read as dollars. Anything else is not an amount. */
function readAmount(s: string): number | null {
  const t = s.replace(/[\s$,]/g, "");
  return /^\d+(\.\d{1,2})?$/.test(t) ? Number(t) : null;
}
function amountProblem(s: string): string {
  const n = readAmount(s);
  if (n === null) return "Type dollars, like 420.";
  if (n < 1 || n > 20000) return "Type an amount from $1 to $20,000.";
  return "";
}

/**
 * Forms with changes that are not saved yet. While any is open, leaving the page asks first: closing the tab or
 * reloading gets the browser's own question, and a link inside the site gets the same question before it navigates.
 */
const unsaved = new Set<symbol>();
const LEAVE = "Leave this page? The changes you have not saved will be lost.";
function askBeforeUnload(e: BeforeUnloadEvent) {
  e.preventDefault();
  e.returnValue = "";
}
function askBeforeLink(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
  if (!(a instanceof HTMLAnchorElement) || a.target === "_blank" || a.hasAttribute("download")) return;
  const to = new URL(a.href, window.location.href);
  if (to.origin !== window.location.origin || (to.pathname === window.location.pathname && to.search === window.location.search)) return;
  if (!window.confirm(LEAVE)) {
    e.preventDefault();
    e.stopPropagation();
  }
}
function useLeaveGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const key = Symbol("unsaved");
    if (unsaved.size === 0) {
      window.addEventListener("beforeunload", askBeforeUnload);
      document.addEventListener("click", askBeforeLink, true);
    }
    unsaved.add(key);
    return () => {
      unsaved.delete(key);
      if (unsaved.size === 0) {
        window.removeEventListener("beforeunload", askBeforeUnload);
        document.removeEventListener("click", askBeforeLink, true);
      }
    };
  }, [dirty]);
}

type Draft = { title: string; detail: string; amount: string; category: string; vendor: string; payeePaypal: string; recurring: boolean };
const empty: Draft = { title: "", detail: "", amount: "", category: "equipment", vendor: "", payeePaypal: "", recurring: false };

/** The same format check the server makes (isPayPalEmail in src/lib/households.ts), so a typo shows before saving. */
const PAYPAL_EMAIL = /^[^\s@<>()"',;:]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const payeeProblem = (s: string) => (!s.trim() || (s.trim().length <= 254 && PAYPAL_EMAIL.test(s.trim())) ? "" : "Type the email the shop's PayPal account signs in with, like shop@example.com.");

function NeedForm({ initial, submitLabel, onSubmit, onCancel, w, fixedPayee = false }: { initial: Draft; submitLabel: string; onSubmit: (d: Draft) => Promise<void>; onCancel?: () => void; w: Words; fixedPayee?: boolean }) {
  const [d, setD] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [amountNote, setAmountNote] = useState("");
  const [payeeNote, setPayeeNote] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);
  const payeeRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const housing = HOUSING.has(d.category);
  const dirty = (Object.keys(initial) as (keyof Draft)[]).some((k) => d[k] !== initial[k]);
  useLeaveGuard(dirty);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  return (
    <form
      className="mg-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const problem = amountProblem(d.amount);
        if (problem) {
          setAmountNote(problem);
          amountRef.current?.focus();
          return;
        }
        const payee = housing || fixedPayee ? "" : payeeProblem(d.payeePaypal);
        if (payee) {
          setPayeeNote(payee);
          payeeRef.current?.focus();
          return;
        }
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
        <input value={d.title} onChange={(e) => set("title", e.target.value)} required minLength={2} maxLength={80} placeholder="Wheelchair repair" autoFocus />
      </label>
      <div className="mg-field">
        <label htmlFor={`${id}-amount`}>Amount still needed</label>
        <input
          ref={amountRef}
          id={`${id}-amount`}
          value={d.amount}
          onChange={(e) => {
            set("amount", e.target.value);
            // Once a problem is showing, it clears the moment the amount reads as dollars.
            if (amountNote) setAmountNote(amountProblem(e.target.value));
          }}
          onBlur={(e) => setAmountNote(e.target.value.trim() ? amountProblem(e.target.value) : "")}
          inputMode="decimal"
          autoComplete="off"
          required
          placeholder="420"
          aria-invalid={amountNote ? true : undefined}
          aria-describedby={amountNote ? `${id}-amount-note` : undefined}
        />
        {amountNote && (
          <p id={`${id}-amount-note`} className="mg-field-note" role="alert">
            {amountNote}
          </p>
        )}
      </div>
      <label className="mg-field">
        <span>Category</span>
        <select value={d.category} onChange={(e) => set("category", e.target.value)}>
          <optgroup label="Paid straight to the shop">
            {SHOP_CATEGORIES.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </optgroup>
          <optgroup label={`Housing, sent to ${w.poss} ABLE account`}>
            {HOUSING_CATEGORIES.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      <label className="mg-field mg-wide">
        <span>{housing ? "Paid to" : "Who is paid: the shop, clinic or school"}</span>
        <input value={housing ? `${w.Poss} ABLE account. Housing always goes there.` : d.vendor} onChange={(e) => set("vendor", e.target.value)} disabled={housing} maxLength={80} placeholder="Riverside Mobility Repair" />
      </label>
      {!housing && (
        <div className="mg-field mg-wide">
          <label htmlFor={`${id}-payee`}>The shop&rsquo;s PayPal email (optional)</label>
          <input
            ref={payeeRef}
            id={`${id}-payee`}
            type="email"
            value={fixedPayee ? "" : d.payeePaypal}
            onChange={(e) => {
              set("payeePaypal", e.target.value);
              if (payeeNote) setPayeeNote(payeeProblem(e.target.value));
            }}
            onBlur={(e) => setPayeeNote(payeeProblem(e.target.value))}
            disabled={fixedPayee}
            maxLength={254}
            autoComplete="off"
            spellCheck={false}
            placeholder={fixedPayee ? "This sample shop keeps its own sandbox account" : "shop@example.com"}
            aria-invalid={payeeNote ? true : undefined}
            aria-describedby={`${id}-payee-hint${payeeNote ? ` ${id}-payee-note` : ""}`}
          />
          <p id={`${id}-payee-hint`} className="mg-field-hint">
            {fixedPayee ? "The sample page pays its own sandbox test shops." : "PayPal pays this account directly for this need, in the sandbox. Left empty, the shared sandbox shop account is paid."}
          </p>
          {payeeNote && (
            <p id={`${id}-payee-note`} className="mg-field-note" role="alert">
              {payeeNote}
            </p>
          )}
        </div>
      )}
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

const toBody = (d: Draft, fixedPayee = false) => ({
  title: d.title,
  detail: d.detail || undefined,
  amount: readAmount(d.amount) ?? 0,
  category: d.category,
  vendor: d.vendor || null,
  // A sample shop's payee is not sent, so it stays; otherwise an empty field sets the shared sandbox account.
  ...(fixedPayee || HOUSING.has(d.category) ? {} : { payeePaypal: d.payeePaypal.trim() || null }),
  recurring: d.recurring,
});

export function ManageNeeds({ token, needs, w }: { token: string; needs: ManageNeed[]; w: Words }) {
  const router = useRouter();
  const [editing, setEditing] = useState<number | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);
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
                w={w}
                initial={{ title: n.title, detail: n.detail, amount: String(n.amount), category: n.category, vendor: n.route === "able" ? "" : n.paidTo, payeePaypal: n.payeePaypal ?? "", recurring: n.recurring }}
                fixedPayee={n.fixedPayee}
                submitLabel="Save changes"
                onCancel={() => setEditing(null)}
                onSubmit={async (d) => {
                  await send(`${base}/needs/${n.id}`, "PATCH", toBody(d, n.fixedPayee));
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
                    {n.payeePaypal && <span className="mg-need-payee">, PayPal account {n.payeePaypal}</span>}
                  </p>
                  {/* The line above already says where it is paid, so the rule starts with what it means. */}
                  <p className="mg-need-rule">{n.rule.replace(/^Paid straight to the shop, so it is not counted\./, "Not counted as income.")}</p>
                </div>
                <div className="mg-need-side">
                  <p className="mg-need-amount tabular">{usd(n.amount)}</p>
                  <p className="mg-need-funded tabular">{n.status === "paid" ? "Paid in full" : n.funded > 0 ? `${usd(n.funded)} given` : "Nothing given yet"}</p>
                  {removing === n.id ? (
                    // Removing is one more press, next to the need it names, so a slip of the thumb changes nothing.
                    <div className="mg-need-confirm" role="group" aria-label={`Remove ${n.title}?`}>
                      <p>Remove {n.title}?</p>
                      <div className="mg-need-actions">
                        <button
                          type="button"
                          className="mg-link mg-link-strong"
                          onClick={async () => {
                            setNote("");
                            try {
                              await send(`${base}/needs/${n.id}`, "DELETE");
                              setRemoving(null);
                              router.refresh();
                            } catch (err) {
                              setNote((err as Error).message);
                            }
                          }}
                        >
                          Remove
                        </button>
                        {/* Focus lands on the safe choice, where the Remove button was. */}
                        <button type="button" className="mg-link" autoFocus onClick={() => setRemoving(null)}>
                          Keep it
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mg-need-actions">
                      <button type="button" className="mg-link" onClick={() => setEditing(n.id)} aria-label={`Edit ${n.title}`}>
                        Edit
                      </button>
                      {n.removable && (
                        <button type="button" className="mg-link" onClick={() => setRemoving(n.id)} aria-label={`Remove ${n.title}`}>
                          Remove
                        </button>
                      )}
                    </div>
                  )}
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
        <div className="mg-need mg-adding" data-ui>
          <NeedForm
            w={w}
            initial={empty}
            submitLabel="Add this need"
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
      <GiftFinder token={token} w={w} onAdded={() => router.refresh()} />
    </div>
  );
}

export function PageStatus({ token, status, note: initialNote }: { token: string; status: string; note: string }) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote);
  const [saved, setSaved] = useState(initialNote);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useLeaveGuard(note !== saved);
  const base = `/api/manage/${encodeURIComponent(token)}`;
  const run = async (body: unknown, done: string, after?: () => void) => {
    setBusy(true);
    setMsg("");
    try {
      await send(base, "PATCH", body);
      after?.();
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
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} rows={4} />
      </label>
      <div className="mg-form-actions">
        <button type="button" className="btn btn-ink" disabled={busy} onClick={() => run({ note }, "Note saved.", () => setSaved(note))}>
          Save the note
        </button>
        <span className="mg-note" role="status">
          {msg}
        </span>
      </div>
      <div className="mg-status-gifts">
        <p className="mg-status-k">{status === "closed" ? "The page is not taking gifts. Its receipts stay public." : "When every need is met, the page can stop taking gifts. Its receipts stay public."}</p>
        {status === "closed" ? (
          <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => run({ status: "open" }, "The page takes gifts again.")}>
            Take gifts again
          </button>
        ) : (
          <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => run({ status: "closed" }, "The page has stopped taking gifts. Its receipts stay public.")}>
            Stop taking gifts
          </button>
        )}
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
  useLeaveGuard(url.trim() !== (saved ?? ""));
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
        <span>Zapier web address</span>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.zapier.com/hooks/catch/…" inputMode="url" autoComplete="off" spellCheck={false} />
      </label>
      <div className="mg-form-actions">
        <button
          type="button"
          className="btn btn-ink"
          disabled={busy || !url.trim()}
          onClick={() =>
            act(async () => {
              const d = await send(base, "PUT", { url: url.trim() });
              setSaved(d.url);
              setUrl(d.url);
              setSecret(d.secret);
              setMsg("Saved. Each gift is sent here as soon as PayPal completes it.");
            })
          }
        >
          Save the address
        </button>
        {saved && (
          <>
            <button
              type="button"
              className="btn btn-quiet"
              disabled={busy}
              onClick={() =>
                act(async () => {
                  await send(base, "POST");
                  setMsg("Test sent, and it arrived.");
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
                  setMsg("Removed. No more gifts are sent there.");
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
          Secret code, for checking that each gift came from Giftwise: <code>{secret}</code>
        </p>
      )}
    </div>
  );
}

type Found = {
  id: string;
  title: string;
  brand: string | null;
  image: string | null;
  imageAlt: string | null;
  url: string | null;
  domain: string | null;
  price: number;
  inStock: boolean;
  category: string;
  giftCard: boolean;
  addable: boolean;
  check: number;
  rule: string;
};

/** Search real products for a need; every result is checked against the SSI rules before it can be added. */
export function GiftFinder({ token, onAdded, w }: { token: string; onAdded: () => void; w: Words }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ mode: string; note?: string; products: Found[] } | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState("");
  const base = `/api/manage/${encodeURIComponent(token)}`;
  const they = w.subj === "they";
  return (
    <section className="mg-finder" aria-labelledby="mg-finder-h">
      <h3 id="mg-finder-h" className="mg-finder-h">
        Find it with Channel3
      </h3>
      <p className="mg-finder-sub">Search real products across retailers. Giftwise checks each one against the SSI rules before it can go on the page.</p>
      <form
        className="mg-finder-form"
        role="search"
        onSubmit={async (e) => {
          e.preventDefault();
          if (q.trim().length < 2) {
            setMsg(`Type what ${w.subj} ${they ? "need" : "needs"}, like a laptop.`);
            return;
          }
          setBusy(true);
          setMsg("");
          try {
            setRes(await send(`${base}/find?q=${encodeURIComponent(q.trim())}`, "GET"));
          } catch (err) {
            setMsg((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="mg-field mg-finder-q">
          <span>
            What {they ? "do" : "does"} {w.subj} need?
          </span>
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (msg) setMsg("");
            }}
            placeholder="wheelchair cushion"
            maxLength={120}
            enterKeyHint="search"
          />
        </label>
        <button type="submit" className="btn btn-ink" disabled={busy}>
          {busy ? "Searching…" : "Search"}
        </button>
      </form>
      {msg && (
        <p className="mg-note mg-finder-msg" role="status">
          {msg}
        </p>
      )}
      {res && (
        <div aria-live="polite">
          <p className="mg-finder-mode muted">{res.mode === "live" ? `${res.products.length} products from Channel3, each checked against the rules.` : res.note}</p>
          <ul className="mg-finds">
            {res.products.map((p) => (
              <li key={p.id} className="mg-find" data-ui data-blocked={p.addable ? undefined : ""}>
                <div className="mg-find-img" aria-hidden={p.image ? undefined : "true"}>
                  {p.image ? (
                    // Product images come from many retailers' hosts, so a plain img is used rather than next/image.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image}
                      alt={p.imageAlt ?? p.title}
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        // A broken photo shows the category instead of an empty frame.
                        const el = e.currentTarget;
                        el.replaceWith(Object.assign(document.createElement("span"), { className: "mg-find-noimg", textContent: p.category.replace("_", " ") }));
                      }}
                    />
                  ) : (
                    <span className="mg-find-noimg">{p.category.replace("_", " ")}</span>
                  )}
                </div>
                <div className="mg-find-body">
                  <p className="mg-find-title">{p.title}</p>
                  <p className="mg-find-where muted">
                    {p.domain ?? "Retailer"}
                    {p.brand && p.brand !== "Sample" ? `, ${p.brand}` : ""}
                  </p>
                  <p className="mg-find-price tabular">{usd(p.price)}</p>
                  <p className="mg-find-rule" data-tone={p.addable ? "kept" : "attention"}>
                    {p.rule}
                  </p>
                  <div className="mg-find-actions">
                    {p.addable ? (
                      <button
                        type="button"
                        className="btn btn-ink"
                        disabled={added.has(p.id)}
                        onClick={async () => {
                          setMsg("");
                          try {
                            await send(`${base}/needs`, "POST", {
                              title: p.title.slice(0, 80),
                              amount: p.price,
                              category: p.category,
                              vendor: p.domain,
                              link: p.url,
                              detail: p.domain ? `From ${p.domain}.` : undefined,
                            });
                            setAdded((x) => new Set(x).add(p.id));
                            onAdded();
                          } catch (err) {
                            setMsg((err as Error).message);
                          }
                        }}
                      >
                        {added.has(p.id) ? "Added" : "Add to the page"}
                      </button>
                    ) : null}
                    {p.url && (
                      <a className="text-link" href={p.url} target="_blank" rel="noreferrer nofollow">
                        See it at {p.domain}
                      </a>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
