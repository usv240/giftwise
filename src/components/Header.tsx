"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ViewMenu } from "./ViewMenu";

/** What a person does here: give, organize a page, report to Social Security, and check the evidence. The rest is in the footer. */
const LINKS = [
  { href: "/g/maya", label: "Give", match: /^\/(g\/[^/]+(\/calendar)?|r\/.+|m\/.+)$/ },
  { href: "/manage/maya-sample-organizer", label: "Organize", match: /^\/(manage\/.+|try(\/.*)?|organizations)$/ },
  { href: "/g/maya/report", label: "Report", match: /^\/(g\/[^/]+\/report(\/.*)?|v\/.+)$/ },
  { href: "/evidence", label: "Evidence", match: /^\/evidence(\/.*)?$/ },
];

/** The header's own words in Spanish, for the Spanish gift page, receipt and Easy Read report. */
const WORDS = {
  en: { cta: "Start a gift page", menu: "Menu", close: "Close" },
  es: { cta: "Crear una página de regalos", menu: "Menú", close: "Cerrar" },
} as const;

/** The section a path belongs to, so its link can say "you are here". */
const current = (path: string, match: RegExp) => match.test(path);

/** The path is URL data, so the bar that reads it streams inside Suspense; the fallback is the same bar with no
 *  "you are here" marker, so nothing moves when it resolves. */
export function Header() {
  return (
    <Suspense fallback={<HeaderBar path={null} />}>
      <HeaderAt />
    </Suspense>
  );
}

function HeaderAt() {
  return <HeaderBar path={usePathname()} />;
}

function HeaderBar({ path }: { path: string | null }) {
  const [menu, setMenu] = useState(false);
  const [lang, setLang] = useState<"en" | "es">("en");
  const sheet = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const w = WORDS[lang];

  // Spanish pages are the same routes with ?lang=es. Read it after hydration, so the header stays one static shell.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLang(new URLSearchParams(window.location.search).get("lang") === "es" ? "es" : "en");
    setMenu(false);
  }, [path]);

  // The phone menu is a full sheet: the page behind it stops scrolling, Escape closes it and returns focus to Menu,
  // and focus starts on the first link.
  useEffect(() => {
    if (!menu) return;
    const root = document.documentElement;
    root.dataset.menu = "open";
    sheet.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        button.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      delete root.dataset.menu;
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  return (
    <header className="site-header frame">
      <Link href="/" className="wordmark" aria-label="Giftwise home">
        <span className="wordmark-mark" aria-hidden="true" />
        Giftwise
      </Link>
      <nav aria-label="Main" className="site-nav">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="nav-link" aria-current={path && current(path, l.match) ? "page" : undefined}>
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="header-actions">
        <ViewMenu lang={lang} />
        <Link href="/try#fundraiser" className="btn btn-primary header-cta">
          {w.cta}
        </Link>
        <button ref={button} type="button" className="btn btn-quiet menu-btn" aria-expanded={menu} aria-controls="mobile-menu" onClick={() => setMenu((m) => !m)}>
          {menu ? w.close : w.menu}
        </button>
      </div>
      {menu && (
        <div ref={sheet} id="mobile-menu" className="mobile-menu">
          <nav aria-label="Main mobile">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="mobile-link" aria-current={path && current(path, l.match) ? "page" : undefined} onClick={() => setMenu(false)}>
                {l.label}
              </Link>
            ))}
            <Link href="/try#fundraiser" className="btn btn-primary mobile-cta" onClick={() => setMenu(false)}>
              {w.cta}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
