import { and, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Info } from "@/components/Info";
import { ADOPTION_ROUTES } from "@/components/judges/Adoption";
import { OrgPayouts, type OrgHousehold } from "@/components/org/OrgPayouts";
import { db, dbConfigured, schema } from "@/lib/db";
import { ensureSample, openNeeds } from "@/lib/households";
import { paypalConfigured } from "@/lib/paypal/client";
import { FUNDER, LIMITS } from "@/lib/paypal/payouts";
import { fundBalance } from "@/lib/paypal/reporting";
import { usd } from "@/lib/rules";
import "../pages.css";
import "../try/try.css";
import "../g/[slug]/gift.css";
import "../developers/dev.css";
import "./org.css";

/** The organization's case: the same facts and source as the Payee organizations card on the Evidence page. */
const PAYEES = ADOPTION_ROUTES.find((r) => r.who === "Payee organizations");

export const metadata: Metadata = { title: "For organizations", description: "Foundations and mutual-aid funds pay many families' needs in one PayPal payout batch, each grant routed so the SSI check stays whole." };

async function Fund({ searchParams }: { searchParams: Promise<{ batch?: string }> }) {
  await connection();
  const { batch } = await searchParams;
  if (!dbConfigured() || !paypalConfigured()) return <p className="page-loading">Payouts need PayPal and the database, which are not connected on this server.</p>;
  await ensureSample();
  const d = db();
  // The sample household first, then the most recent pages people made, leaving out the test suites' own pages.
  const rows = await d
    .select()
    .from(schema.households)
    .where(or(eq(schema.households.isSample, true), and(eq(schema.households.isSample, false), ne(schema.households.caregiverName, "E2E"))))
    .orderBy(desc(schema.households.isSample), desc(schema.households.createdAt))
    .limit(LIMITS.households);
  const households: OrgHousehold[] = [];
  for (const h of rows) {
    const needs = await d.select().from(schema.needs).where(and(eq(schema.needs.householdId, h.id), isNull(schema.needs.archivedAt)));
    const open = openNeeds(needs).reduce((s, n) => s + Math.max(0, n.amount - n.funded), 0);
    households.push({ slug: h.slug, name: h.name, open });
  }
  const [balance, recent] = await Promise.all([
    fundBalance(),
    d
      .select({ batchId: schema.payouts.batchId, total: sql<string>`sum(${schema.payouts.amount})`, items: sql<number>`count(*)::int`, at: sql<Date>`min(${schema.payouts.createdAt})` })
      .from(schema.payouts)
      .groupBy(schema.payouts.batchId)
      .orderBy(desc(sql`min(${schema.payouts.createdAt})`))
      .limit(5),
  ]);
  // The fund's balance sits beside the grants, above the batch it pays for.
  const fund = (
    <section className="org-fund" aria-labelledby="fund-h" data-ui>
      <div>
        <p className="result-k" id="fund-h">
          {FUNDER}
        </p>
        <p className="org-balance tabular">{balance ? usd(balance.available) : "Unavailable"}</p>
        <p className="muted">
          Available in the fund&rsquo;s PayPal account{balance?.asOf ? `, as PayPal reported it at ${new Date(balance.asOf).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" })} ET` : ""}. Sandbox money.
        </p>
      </div>
      <Info id="org.fund" label="" />
    </section>
  );
  return (
    <>
      <OrgPayouts fund={fund} households={households} limits={{ perHousehold: LIMITS.perHousehold, perBatch: LIMITS.perBatch }} initialBatch={batch && /^[A-Z0-9]{8,30}$/.test(batch) ? batch : undefined} />
      {recent.length > 0 && (
        <section className="page-section" aria-labelledby="recent-h">
          <h2 id="recent-h">Recent batches</h2>
          <ul className="org-recent">
            {recent.map((b) => (
              <li key={b.batchId}>
                <Link className="text-link tabular" href={`/organizations?batch=${b.batchId}#batch-h`}>
                  {b.batchId}
                </Link>{" "}
                <span className="muted">
                  {usd(Number(b.total))} to {b.items} {b.items === 1 ? "payee" : "payees"}, {new Date(b.at).toLocaleDateString("en-US", { dateStyle: "medium" })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export default function OrganizationsPage({ searchParams }: { searchParams: Promise<{ batch?: string }> }) {
  return (
    <div className="page frame organizations">
      <header className="page-head">
        <div className="title-row">
          <h1 className="page-title">For organizations</h1>
          <Info id="page.organizations" />
        </div>
        <p className="lede">Pay many families&rsquo; needs in one PayPal payout.</p>
        <p className="page-prose">
          Disability foundations, mutual-aid funds and churches often hold money for families. Giftwise routes each grant by the rules and pays every shop and ABLE account in one PayPal payout batch, so no family&rsquo;s SSI check goes down.
        </p>
      </header>
      <Suspense fallback={<p className="page-loading">Loading the fund…</p>}>
        <Fund searchParams={searchParams} />
      </Suspense>
      {PAYEES && (
        <section className="page-section org-case" aria-labelledby="org-case-h">
          <h2 id="org-case-h">Built for payee organizations</h2>
          <div className="org-case-card" data-ui>
            <p className="org-case-n tabular">{PAYEES.count}</p>
            <p className="org-case-size">{PAYEES.size}</p>
            <p className="org-case-use">
              <span className="org-case-k">With Giftwise. </span>
              {PAYEES.use}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
