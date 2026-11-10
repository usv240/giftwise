import type { Metadata } from "next";
import Link from "next/link";
import { CtaDialog } from "@/components/landing/CtaDialog";
import "../pages.css";
import "../landing.css";
import "./start.css";

export const metadata: Metadata = {
  title: "Start a gift page",
  description: "Make a gift page for someone on SSI: who it is for, what they need, and one PayPal checkout that pays each shop the rules pick.",
};

const STEPS = [
  { k: "Who it is for", v: "Their first name, and the pronouns the page uses for them." },
  {
    k: "Their situation",
    v: "Where they live and any Social Security or other income, in plain questions, or read from their letter from Social Security. The page then shows their own check. Optional: skip it and add it later.",
  },
  { k: "What they need", v: "Paste a fundraiser’s link or start from the sample. The rules pick how each need is paid, so the help keeps their check whole." },
  { k: "Share it", v: "Givers see the page and pay through PayPal. You keep a private link to add, change or close needs." },
];

/** The create form, on its own page: the header's "Start a gift page" opens here. The name carries over to /try. */
export default function StartPage() {
  return (
    <div className="page frame start">
      <header className="page-head">
        <h1 className="page-title">Start a gift page</h1>
        <p className="lede">A page for one person on SSI: what they need, who sells it, and one PayPal checkout that pays each shop directly.</p>
      </header>
      <div className="start-grid">
        <ol className="start-steps">
          {STEPS.map((s) => (
            <li key={s.k} className="start-step">
              <p className="start-step-k">{s.k}</p>
              <p className="start-step-v">{s.v}</p>
            </li>
          ))}
        </ol>
        <CtaDialog heading={null} situation />
      </div>
      <p className="start-more">
        <Link className="text-link" href="/g/maya">
          See a finished page: Maya&rsquo;s
        </Link>
        <Link className="text-link" href="/try">
          Try a single gift or a bill first
        </Link>
      </p>
    </div>
  );
}
