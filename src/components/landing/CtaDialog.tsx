"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Info } from "../Info";

/** "First step, already open": the product's own create dialog at true size. */
export function CtaDialog() {
  const router = useRouter();
  const [name, setName] = useState("Maya");
  const [role, setRole] = useState<"caregiver" | "giver">("caregiver");
  return (
    <form
      className="cta-dialog"
      data-ui
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/app?name=${encodeURIComponent(name.trim() || "Maya")}&role=${role}`);
      }}
    >
      <div className="cta-dialog-head">
        <h3 className="cta-dialog-title">Start a gift page</h3>
        <Info id="cta.dialog" label="" />
      </div>
      <label className="cta-field">
        <span>Who is it for?</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      </label>
      <fieldset className="cta-field">
        <legend>I am</legend>
        <div className="checker-seg">
          {(
            [
              ["caregiver", "Her caregiver"],
              ["giver", "Giving a gift"],
            ] as const
          ).map(([v, l]) => (
            <label key={v} className="checker-seg-opt" data-on={role === v ? "" : undefined}>
              <input type="radio" name="cta-role" value={v} checked={role === v} onChange={() => setRole(v)} />
              {l}
            </label>
          ))}
        </div>
      </fieldset>
      <button type="submit" className="btn btn-primary cta-submit">
        Create page
      </button>
      <p className="cta-fine">No sign-up. Runs in PayPal sandbox.</p>
    </form>
  );
}
