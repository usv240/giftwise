import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "@/components/Info";
import { TryTabs } from "@/components/try/TryTabs";
import { PRESETS } from "@/lib/presets";
import "./try.css";

export const metadata: Metadata = {
  title: "Try it with your own situation",
  description: "Describe a gift, plan a month, upload a bill or paste a fundraiser link, and see how Social Security would count it.",
};

export default function TryPage() {
  return (
    <div className="try frame">
      <header className="try-head">
        <div className="title-row">
          <h1 className="try-title">Try it with your own situation</h1>
          <Info id="page.try" />
        </div>
        <p className="lede">Describe a gift, plan a month of gifts, upload a bill, or paste a fundraiser link. Or open a ready-made example.</p>
      </header>
      <div className="try-layout">
        <TryTabs />
        <aside className="presets" aria-labelledby="presets-title">
          <div className="title-row">
            <h2 id="presets-title" className="presets-title">
              Ready-made examples
            </h2>
            <Info id="try.presets" label="" />
          </div>
          <ul className="presets-list">
            {PRESETS.map((p) => (
              <li key={p.id} className="preset-row">
                <div>
                  <p className="preset-name">{p.title}</p>
                  <p className="preset-sum">{p.summary}</p>
                </div>
                <div className="preset-actions">
                  <Link href={`/try/presets/${p.id}`} className="text-link">
                    View
                  </Link>
                  <a href={`/api/presets/${p.id}`} className="text-link" download>
                    Download as data
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
