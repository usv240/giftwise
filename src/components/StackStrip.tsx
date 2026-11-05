"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, Suspense } from "react";
import { Info } from "./Info";

// Only tools that are running in this build. Add one here when it ships, not before.
export const STACK = [
  { id: "paypal", name: "PayPal" },
  { id: "claude", name: "Claude" },
  { id: "ag-studio", name: "AG Studio" },
  { id: "render", name: "Render" },
  { id: "elastic", name: "Elasticsearch" },
  { id: "channel3", name: "Channel3" },
  { id: "bryntum", name: "Bryntum" },
  { id: "postman", name: "Postman" },
  { id: "apimatic", name: "APIMatic" },
] as const;

/** Shown above the footer on every page but the printable records: every tool used, with what it does here. */
export function StackStrip() {
  return (
    <Suspense fallback={null}>
      <StackStripAt />
    </Suspense>
  );
}

function StackStripAt() {
  const path = usePathname() ?? "/";
  // The month's report, its Easy Read version and the page that checks a report are documents; they end with the record.
  if (/^\/g\/[^/]+\/report|^\/v\//.test(path)) return null;
  return (
    <section className="stack-strip frame" aria-labelledby="stack-strip-title">
      <h2 id="stack-strip-title" className="sr-only">
        Built with
      </h2>
      <p className="stack-sentence">
        Built with{" "}
        {STACK.map((t, i) => (
          <Fragment key={t.id}>
            <Link href={`/stack#${t.id}`} className="text-link stack-item">
              {t.name}
            </Link>
            {i < STACK.length - 2 ? ", " : i === STACK.length - 2 ? " and " : "."}
          </Fragment>
        ))}{" "}
        <Info id="stack.strip" />
      </p>
    </section>
  );
}
