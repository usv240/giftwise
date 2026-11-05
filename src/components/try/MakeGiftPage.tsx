"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Info } from "../Info";
import { usd, type Category } from "@/lib/rules";

export type FundraiserUse = { use: string; amount: number; category: Category; likely_vendor: string | null };

/** Fit a title into 80 characters at a word boundary. */
const fit = (s: string) => (s.length <= 80 ? s : s.slice(0, s.lastIndexOf(" ", 80) > 40 ? s.lastIndexOf(" ", 80) : 80).replace(/[\s,;:-]+$/, ""));

const PRONOUNS = [
  { value: "she", label: "she/her" },
  { value: "he", label: "he/him" },
  { value: "they", label: "they/them" },
] as const;

/** Turn what a fundraiser asks for into a live gift page, where every dollar goes straight to the shop or the ABLE account. */
export function MakeGiftPage({ uses, sourceUrl, initialName = "" }: { uses: FundraiserUse[]; sourceUrl: string; initialName?: string }) {
  const router = useRouter();
  const usable = uses.filter((u) => u.amount > 0).slice(0, 8);
  const [name, setName] = useState(initialName);
  const [pronoun, setPronoun] = useState<"she" | "he" | "they">("they");
  const [organizer, setOrganizer] = useState("");
  const [picked, setPicked] = useState<boolean[]>(usable.map(() => true));
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [note, setNote] = useState("");

  if (usable.length === 0) return null;
  const chosen = usable.filter((_, i) => picked[i]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setStatus("working");
    setNote("");
    try {
      const r = await fetch("/api/v1/gift-pages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          pronoun,
          organizer: organizer.trim() || undefined,
          source_url: /^https?:\/\//.test(sourceUrl) ? sourceUrl : undefined,
          needs: chosen.map((u) => ({ title: fit(u.use), amount: Math.round(u.amount * 100) / 100, category: u.category, vendor: u.likely_vendor })),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "The page could not be made. Please try again.");
      router.push(`${j.data.manage_url}?new=1`);
    } catch (err) {
      setNote((err as Error).message);
      setStatus("error");
    }
  }

  return (
    <form className="read-card make-page" data-ui onSubmit={create}>
      <div className="title-row">
        <p className="result-k">Make a gift page from this fundraiser</p>
        <Info id="try.makepage" label="" />
      </div>
      <p className="read-plain">Givers pay each need through PayPal, straight to the shop or the ABLE account. Nothing goes through their bank, so the SSI check stays whole.</p>
      <div className="try-row">
        <label className="try-field try-grow">
          <span>Their first name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} autoComplete="off" />
        </label>
        <label className="try-field try-grow">
          <span>Your name (optional)</span>
          <input value={organizer} onChange={(e) => setOrganizer(e.target.value)} maxLength={60} autoComplete="name" />
        </label>
      </div>
      <fieldset className="try-fieldset">
        <legend className="try-legend">How the page refers to them</legend>
        <div className="make-pronouns">
          {PRONOUNS.map((p) => (
            <label key={p.value} className="try-check">
              <input type="radio" name="pronoun" value={p.value} checked={pronoun === p.value} onChange={() => setPronoun(p.value)} />
              {p.label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="try-fieldset">
        <legend className="try-legend">Needs to include</legend>
        {usable.map((u, i) => (
          <label key={i} className="try-check make-need">
            <input type="checkbox" checked={picked[i]} onChange={() => setPicked((p) => p.map((v, j) => (j === i ? !v : v)))} />
            <span>{u.use}</span>
            <span className="tabular">{usd(u.amount)}</span>
          </label>
        ))}
      </fieldset>
      <div className="try-actions">
        <button type="submit" className="btn btn-primary" disabled={status === "working" || chosen.length === 0 || !name.trim()}>
          {status === "working" ? "Making the page…" : "Make the gift page"}
        </button>
      </div>
      {status === "error" && <p className="result-attention">{note}</p>}
      <p className="muted try-privacy">Sandbox pages for trying Giftwise. No real money moves.</p>
    </form>
  );
}
