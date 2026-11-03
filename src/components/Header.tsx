"use client";

import Link from "next/link";
import { useState } from "react";
import { ViewMenu } from "./ViewMenu";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/try", label: "Try it" },
  { href: "/learn", label: "Learn" },
  { href: "/developers", label: "Developers" },
  { href: "/judges", label: "For judges" },
];

export function Header() {
  const [menu, setMenu] = useState(false);
  return (
    <header className="site-header frame">
      <Link href="/" className="wordmark" aria-label="Giftwise home">
        <span className="wordmark-mark" aria-hidden="true" />
        Giftwise
      </Link>
      <nav aria-label="Main" className="site-nav">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="nav-link">
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="header-actions">
        <ViewMenu />
        <Link href="/try#fundraiser" className="btn btn-primary header-cta">
          Start a gift page
        </Link>
        <button type="button" className="btn btn-quiet menu-btn" aria-expanded={menu} aria-controls="mobile-menu" onClick={() => setMenu((m) => !m)}>
          {menu ? "Close" : "Menu"}
        </button>
      </div>
      {menu && (
        <div id="mobile-menu" className="mobile-menu">
          <nav aria-label="Main mobile">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="mobile-link" onClick={() => setMenu(false)}>
                {l.label}
              </Link>
            ))}
            <Link href="/try#fundraiser" className="btn btn-primary" onClick={() => setMenu(false)}>
              Start a gift page
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
