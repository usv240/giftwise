"use client";

import { useEffect, useRef, useState } from "react";
import type { FeedEvent } from "@/lib/ops";

const TIME = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

/**
 * The last 50 events, newest first, updated over server-sent events every two seconds. A visitor who asked for
 * reduced motion gets a Refresh button instead of a feed that changes on its own.
 */
export function LiveStream({ initial }: { initial: FeedEvent[] }) {
  const [events, setEvents] = useState(initial);
  const [mode, setMode] = useState<"live" | "manual" | "closed">("manual");
  const [updated, setUpdated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current) return;
    const es = new EventSource("/api/ops/stream");
    es.addEventListener("feed", (e) => {
      setEvents(JSON.parse((e as MessageEvent<string>).data) as FeedEvent[]);
      setUpdated(TIME.format(new Date()));
      setMode("live");
    });
    es.onerror = () => setMode("closed");
    return () => es.close();
  }, []);

  const refresh = async () => {
    setBusy(true);
    try {
      const j = (await (await fetch("/api/ops/feed", { cache: "no-store" })).json()) as { data?: { events: FeedEvent[] } };
      if (j.data) {
        setEvents(j.data.events);
        setUpdated(TIME.format(new Date()));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ops-stream" data-ui>
      <div className="ops-stream-bar">
        <p className="ops-stream-state" aria-live="polite">
          {mode === "live" ? "Live, updated every 2 seconds" : mode === "closed" ? "The stream closed; press Refresh for the latest" : "Press Refresh for the latest"}
          {updated ? <span className="muted tabular"> (at {updated})</span> : null}
        </p>
        <button type="button" className="btn btn-quiet" onClick={refresh} disabled={busy}>
          {busy ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {events.length ? (
        <ol className="ops-feed" aria-label="Latest events, newest first">
          {events.map((e, i) => (
            <li key={`${e.id}-${e.at}-${i}`} className="ops-event" data-kind={e.kind} data-tone={e.tone}>
              <span className="ops-event-time tabular">{TIME.format(new Date(e.at))}</span>
              <span className="ops-event-kind">{e.kind === "ledger" ? "ledger" : "request"}</span>
              <span className="ops-event-text">{e.text}</span>
              <span className="ops-event-detail muted">{e.detail}</span>
              <span className="ops-event-id muted tabular">{e.id.startsWith("req_") ? e.id : ""}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">Nothing recorded yet. Make an API call or a sandbox gift and it appears here.</p>
      )}
    </div>
  );
}
