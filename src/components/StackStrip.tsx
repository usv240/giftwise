import Link from "next/link";
import { Fragment } from "react";
import { Info } from "./Info";

// Only tools that are running in this build. Add one here when it ships, not before.
export const STACK = [
  { id: "paypal", name: "PayPal" },
  { id: "claude", name: "Claude" },
  { id: "render", name: "Render" },
  { id: "apimatic", name: "APIMatic" },
] as const;

/** Shown above the footer on every page: every tool used, with what it does here. */
export function StackStrip() {
  return (
    <section className="stack-strip frame" aria-labelledby="stack-strip-title">
      <h2 id="stack-strip-title" className="sr-only">
        Built with
      </h2>
      <p className="stack-sentence">
        Built with{" "}
        {STACK.map((t, i) => (
          <Fragment key={t.id}>
            <span className="stack-item">
              <Link href={`/stack#${t.id}`} className="text-link">
                {t.name}
              </Link>
              <Info id={`stack.${t.id}`} label="" />
            </span>
            {i < STACK.length - 2 ? ", " : i === STACK.length - 2 ? " and " : "."}
          </Fragment>
        ))}{" "}
        <Info id="stack.strip" />
      </p>
    </section>
  );
}
