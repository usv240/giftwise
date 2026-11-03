"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

const readStore = (key: string) => {
  try {
    return localStorage.getItem(key) ?? "{}";
  } catch {
    return "{}";
  }
};

/** The month's to-do list as real checkboxes. Ticks are remembered in this browser only, per month and view. */
export function Checklist({ storeKey, items }: { storeKey: string; items: { id: string; text: string; ruleId?: string }[] }) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const own = `giftwise-store:${storeKey}`;
      window.addEventListener("storage", onChange);
      window.addEventListener(own, onChange);
      return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener(own, onChange);
      };
    },
    [storeKey],
  );
  // The server and the first paint see nothing ticked; the browser's saved ticks follow without a hydration mismatch.
  const raw = useSyncExternalStore(subscribe, () => readStore(storeKey), () => "{}");
  // Ticks made this visit, so the boxes still work when storage is blocked.
  const [local, setLocal] = useState<Record<string, boolean>>({});
  const done = useMemo(() => {
    try {
      return { ...(JSON.parse(raw) as Record<string, boolean>), ...local };
    } catch {
      return local;
    }
  }, [raw, local]);
  const toggle = (id: string, on: boolean) => {
    const next = { ...done, [id]: on };
    setLocal(next);
    try {
      localStorage.setItem(storeKey, JSON.stringify(next));
      window.dispatchEvent(new Event(`giftwise-store:${storeKey}`));
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
