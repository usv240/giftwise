"use client";

import { useEffect, useId, useState } from "react";

/**
 * A value shown masked, with two controls that reach the keyboard and the thumb (44 px): Copy puts it on the clipboard,
 * Show reads it out for anyone who types it in. The value is in the HTML either way; masking keeps it out of a
 * screenshot or a glance over a shoulder, and the page says what it is next to it.
 */
export function CopySecret({ value, copy, copied, show, hide, name }: { value: string; copy: string; copied: string; show: string; hide: string; name: string }) {
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(false);
  const id = useId();
  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setDone(false), 1800);
    return () => window.clearTimeout(t);
  }, [done]);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
    } catch {
      // No clipboard here (an older browser, or a page without focus): show it so it can be typed instead.
      setShown(true);
    }
  };
  return (
    <span className="cs">
      <code id={id} className="cs-value" data-masked={shown ? undefined : ""} aria-label={shown ? undefined : `${name}, hidden`}>
        {shown ? value : "•".repeat(Math.min(12, Math.max(8, value.length)))}
      </code>
      <span className="cs-actions">
        <button type="button" className="cs-btn" onClick={onCopy} aria-describedby={id}>
          {done ? copied : copy}
        </button>
        <button type="button" className="cs-btn" onClick={() => setShown((s) => !s)} aria-pressed={shown} aria-describedby={id}>
          {shown ? hide : show}
        </button>
      </span>
      <span className="sr-only" role="status" aria-live="polite">
        {done ? copied : ""}
      </span>
    </span>
  );
}
