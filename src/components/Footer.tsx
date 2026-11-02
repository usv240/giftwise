import Link from "next/link";

const NAV = [
  { href: "/try", label: "Try it" },
  { href: "/app", label: "Sample workspace" },
  { href: "/learn", label: "The rules, explained" },
  { href: "/developers", label: "Developers" },
  { href: "/judges", label: "For judges" },
  { href: "/stack", label: "How it is built" },
  { href: "/status", label: "Status" },
  { href: "/about", label: "About" },
];

/** "A footer of tiles" from the dealt direction sheet. */
export function Footer() {
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
        <p>Built for the PayPal AI Hackathon</p>
        <p className="tile-muted">November 2026</p>
      </div>
      <div className="tile tile-repo">
        <a className="tile-email text-link" href="https://github.com/usv240/giftwise">
          github.com/usv240/giftwise
        </a>
        <p className="tile-muted">Open source, MIT licence</p>
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
