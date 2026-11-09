"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

/** Every page the header leaves out, so each one stays a link away. */
const NAV = [
  { href: "/try", label: "Try it" },
  { href: "/start", label: "Make a gift page" },
  { href: "/learn", label: "The rules, explained" },
  { href: "/agents", label: "For AI agents" },
  { href: "/organizations", label: "For organizations" },
  { href: "/dashboard", label: "Maya's year" },
  { href: "/developers", label: "Developers" },
  { href: "/stack", label: "How it is built" },
  { href: "/status", label: "Status" },
  { href: "/ops", label: "Operations" },
  { href: "/about", label: "About" },
];

/** Pages a giver or the family uses: the gift page, receipts, monthly gifts, reports, the check page and the organizer's view. */
const QUIET = /^\/(g|r|m|v|manage)\//;

/** "A footer of tiles" from the dealt direction sheet. On the pages people use to give and keep records, a short footer:
 *  the giving and the records stay the last thing on the page, with the rules and Giftwise one link away. */
export function Footer() {
  return (
    <Suspense fallback={<TileFooter />}>
      <FooterAt />
    </Suspense>
  );
}

function FooterAt() {
  return QUIET.test(usePathname() ?? "/") ? <QuietFooter /> : <TileFooter />;
}

function QuietFooter() {
  return (
    <footer className="footer-quiet frame" aria-label="Site footer">
      <p className="footer-quiet-lead">
        <Link href="/" className="text-link">
          Giftwise
        </Link>{" "}
        helps families give the benefit-safe way.
      </p>
      <nav aria-label="Footer">
        <ul className="footer-quiet-nav">
          <li>
            <Link href="/learn" className="text-link">
              The rules, explained
            </Link>
          </li>
          <li>
            <Link href="/about" className="text-link">
              About
            </Link>
          </li>
          <li>
            <Link href="/status" className="text-link">
              Status
            </Link>
          </li>
          <li>
            <Link href="/ops" className="text-link">
              Operations
            </Link>
          </li>
          <li>
            <Link href="/stack" className="text-link">
              How it is built
            </Link>
          </li>
        </ul>
      </nav>
      <p className="tile-legal">Sandbox demonstration. Guidance based on published Social Security rules, with sources for every answer.</p>
    </footer>
  );
}

function TileFooter() {
  return (
    <footer className="footer-tiles" aria-label="Site footer">
      <div className="tile tile-statement">
        <p className="tile-lead">Giftwise helps families give the benefit-safe way.</p>
        <p className="tile-legal">Sandbox demonstration. Guidance based on published Social Security rules, with sources for every answer.</p>
      </div>
      <nav className="tile tile-nav" aria-label="Footer">
        <ul>
          {NAV.map((n) => (
            <li key={n.href}>
              <Link href={n.href} className="text-link">
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="tile tile-made">
        <p>Runs in the PayPal sandbox</p>
        <p className="tile-muted">No real money moves</p>
      </div>
      <div className="tile tile-repo">
        <Link className="tile-email text-link" href="/">
          giftwise-405i.onrender.com
        </Link>
        <p className="tile-muted">Open source, MIT license</p>
      </div>
      <div className="tile tile-wordmark" aria-hidden="true">
        Giftwise
      </div>
      <Link href="/try" className="tile tile-cta">
        <span>Try it now</span>
        <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
          <path d="M10 38 38 10M16 10h22v22" fill="none" stroke="currentColor" strokeWidth="4" />
        </svg>
      </Link>
    </footer>
  );
}
