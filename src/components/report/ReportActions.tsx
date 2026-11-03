"use client";

import { useEffect, useState } from "react";

/** The month's to-do list as real checkboxes. Ticks are remembered in this browser only, per month and view. */
export function Checklist({ storeKey, items }: { storeKey: string; items: { id: string; text: string; ruleId?: string }[] }) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      setDone(JSON.parse(localStorage.getItem(storeKey) ?? "{}"));
    } catch {
      setDone({});
    }
  }, [storeKey]);
  const toggle = (id: string, on: boolean) => {
    const next = { ...done, [id]: on };
    setDone(next);
    try {
      localStorage.setItem(storeKey, JSON.stringify(next));
    } catch {
      // Storage can be blocked; the box still ticks for this visit.
    }
  };
  return (
    <ul className="rp-todo">
      {items.map((t) => (
        <li key={t.id}>
          <label className="rp-check">
            <input type="checkbox" checked={Boolean(done[t.id])} onChange={(e) => toggle(t.id, e.target.checked)} />
            <span>
              {t.text}
              {t.ruleId && <span className="tech-only rp-tech">{t.ruleId}</span>}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}

/** Print or save the report as a PDF; the print stylesheet keeps only the sheet. */
export function PrintButton() {
  return (
    <button type="button" className="btn btn-quiet" onClick={() => window.print()}>
      Print or save as PDF
    </button>
  );
}

/** Copy the call script, so it can go into a note or a message to whoever makes the call. */
export function CopyScript({ lines }: { lines: string[] }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setState("copied");
    } catch {
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), 2400);
  };
  return (
    <span className="rp-copy">
      <button type="button" className="btn btn-quiet" onClick={copy}>
        Copy the script
      </button>
      <span className="rp-copy-note" role="status" aria-live="polite">
        {state === "copied" ? "Copied" : state === "failed" ? "Select the text to copy it" : ""}
      </span>
    </span>
  );
}
