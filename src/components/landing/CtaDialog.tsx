"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * "First step, already open": the gift page's first question at true size. The name carries over to the page it makes.
 * `heading` is the card's own title; /start passes null because its page title already says it.
 */
export function CtaDialog({ heading = "Start a gift page" }: { heading?: string | null }) {
  const router = useRouter();
  const [name, setName] = useState("Maya");
  return (
    <form
      className="cta-dialog"
      data-ui
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/try?name=${encodeURIComponent(name.trim() || "Maya")}#fundraiser`);
      }}
    >
      {heading && <h3 className="cta-dialog-title">{heading}</h3>}
      <label className="cta-field">
        <span>Who is it for? Their first name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" maxLength={40} />
      </label>
      <button type="submit" className="btn btn-primary cta-submit">
        Next: add the needs
      </button>
      <p className="cta-fine">Paste a fundraiser&rsquo;s link or use the sample. No sign-up. Runs in the PayPal sandbox.</p>
    </form>
  );
}
