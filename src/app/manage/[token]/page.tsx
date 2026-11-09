import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Info } from "@/components/Info";
import { ShareGift } from "@/components/gift/ShareGift";
import { ManageNeeds, Notifications, PageStatus, type ManageNeed } from "@/components/manage/ManageClient";
import { dbConfigured } from "@/lib/db";
import { SAMPLE_MANAGE_TOKEN, manageView } from "@/lib/manage";
import { pageOrigin } from "@/lib/origin";
import { pronounWords, usd } from "@/lib/rules";
import "../../pages.css";
import "../../developers/dev.css";
import "../../g/[slug]/gift.css";
import "./manage.css";

export const metadata: Metadata = {
  title: "Manage a gift page",
  description: "The organizer's view of a Giftwise gift page: needs, gifts received, sharing and notifications.",
  robots: { index: false, follow: false },
};

type Params = { token: string };
type Search = { new?: string };

const when = (d: Date | null) => (d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" }) : "");

async function Manage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const [{ token }, q] = await Promise.all([params, searchParams]);
  if (!dbConfigured()) return <p className="page-loading">Managing a page needs the database. See the README to start it.</p>;
  const v = await manageView(token);
  if (!v) notFound();
  const h = v.household;
  const w = pronounWords(v.profile.pronoun);
  const origin = await pageOrigin();
  const pageUrl = `${origin}/g/${h.slug}`;
  const manageUrl = `${origin}/manage/${token}`;
  const qrSvg = await QRCode.toString(pageUrl, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#21232e", light: "#ffffff" } });
  const given = v.payments.reduce((a, p) => a + Number(p.amount), 0);
  const open = v.needs.filter((n) => n.status !== "paid").reduce((a, n) => a + Math.max(0, Number(n.amount) - Number(n.funded)), 0);
  const needs: ManageNeed[] = v.needs.map((n) => ({
    id: n.id,
    title: n.title,
    detail: n.detail,
    category: n.category,
    route: n.route,
    paidTo: n.payeeName,
    amount: Number(n.amount),
    funded: Number(n.funded),
    status: n.status,
    recurring: n.recurring,
    rule: n.rule,
    removable: !n.hasPayments,
  }));
  const isSampleLink = token === SAMPLE_MANAGE_TOKEN;

  return (
    <>
      <header className="page-head">
        <div className="title-row">
          <h1 className="page-title">Manage {h.name}&rsquo;s page</h1>
          <Info id="page.manage" />
        </div>
        <p className="lede">
          Add, change or remove what the page asks for, see each gift as it arrives, and share the page. Giftwise chooses where each need is paid, so {w.poss} SSI check stays whole.
        </p>
        <p className="mg-head-links">
          <Link className="btn btn-ink" href={`/g/${h.slug}`}>
            Open the page givers see
          </Link>
          <Link className="text-link" href={`/g/${h.slug}/report`}>
            {h.name}&rsquo;s report to Social Security
          </Link>
        </p>
      </header>

      {q.new === "1" && !isSampleLink && (
        <section className="mg-keep" aria-labelledby="mg-keep-h" data-ui>
          <h2 id="mg-keep-h">Keep this link. It is the only key to this page.</h2>
          <p>Giftwise has no accounts and stores only a fingerprint of this link, so it cannot be recovered. Bookmark it, or save it somewhere private.</p>
          <p className="mg-keep-url">
            <code>{manageUrl}</code>
          </p>
        </section>
      )}
      {isSampleLink && (
        <p className="mg-sample muted">This is the sample page&rsquo;s organizer view, open to everyone so you can try it. Reset the sample on {h.name}&rsquo;s page to put everything back.</p>
      )}

      {/* One panel split by hairlines, not four tiles: the four figures are read together. */}
      <section className="mg-summary" aria-label="The page at a glance" data-ui>
        <div>
          <p className="mg-k">Given so far</p>
          <p className="mg-fig tabular">{usd(given)}</p>
        </div>
        <div>
          <p className="mg-k">Still needed</p>
          <p className="mg-fig tabular">{usd(open)}</p>
        </div>
        <div>
          <p className="mg-k">Counted as {w.poss} income</p>
          <p className="mg-fig tabular" data-kept="">
            $0
          </p>
        </div>
        <div>
          <p className="mg-k">The page</p>
          <p className="mg-fig" data-state={h.status}>
            {h.status === "closed" ? "Closed" : "Taking gifts"}
          </p>
        </div>
      </section>

      {/* The needs and the gifts are the work; sharing, notifications and the page's settings sit beside them on a wide screen. */}
      <div className="mg-cols">
        <div className="mg-main">
          <section className="page-section" aria-labelledby="mg-needs-h">
            <div className="title-row">
              <h2 id="mg-needs-h">What the page asks for</h2>
              <Info id="manage.needs" label="" />
            </div>
            <ManageNeeds token={token} needs={needs} w={{ subj: w.subj, poss: w.poss, Poss: w.Poss }} />
          </section>

          <section className="page-section" aria-labelledby="mg-gifts-h">
            <h2 id="mg-gifts-h">Gifts received</h2>
            {v.payments.length ? (
              <div className="doc-table-wrap" tabIndex={0} role="region" aria-label="Gifts received">
                <table className="doc-table">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">From</th>
                      <th scope="col">Paid to</th>
                      <th scope="col" className="num">
                        Amount
                      </th>
                      <th scope="col">Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="tabular">{when(p.capturedAt)}</td>
                        <td>{p.payerName?.split(" ")[0] ?? "A giver"}</td>
                        <td>{p.payeeName}</td>
                        <td className="tabular num">{usd(Number(p.amount))}</td>
                        <td>
                          <Link className="text-link" href={`/r/${p.orderId}`}>
                            Receipt
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="page-prose muted">No gifts yet. Share the page and each one shows up here the moment PayPal completes it.</p>
            )}
          </section>
        </div>

        <div className="mg-side">
          <section className="page-section" aria-labelledby="mg-share-h">
            <h2 id="mg-share-h">Share the page</h2>
            <div className="mg-share">
              <ShareGift url={pageUrl} title={`Help ${h.name}`} text={`Help ${h.name}: every gift is paid straight to the shop through PayPal, so ${w.poss} SSI check stays whole.`} qrSvg={qrSvg} />
            </div>
          </section>

          <section className="page-section" aria-labelledby="mg-notify-h">
            <div className="title-row">
              <h2 id="mg-notify-h">Get a text or email when a gift arrives</h2>
              <Info id="manage.notify" label="" />
            </div>
            <p className="page-prose">
              Paste the web address{" "}
              <a className="text-link" href="https://zapier.com/apps/webhook/integrations" target="_blank" rel="noreferrer">
                Zapier
              </a>{" "}
              gives you, and Zapier can text or email you each gift.
            </p>
            <p className="page-prose mg-tech">Each gift event is signed with the page&rsquo;s secret, so the receiving end can check it came from Giftwise.</p>
            <Notifications token={token} url={h.webhookUrl} />
          </section>

          <section className="page-section" aria-labelledby="mg-page-h">
            <h2 id="mg-page-h">The page</h2>
            <PageStatus token={token} status={h.status} note={h.note} />
          </section>
        </div>
      </div>
    </>
  );
}

/**
 * The organizer's page renders on the server before it is sent: the needs, the gifts received and the sharing tools
 * are in the HTML, complete without client JavaScript, and the forms hydrate on top. The page is one person's private
 * link, so there is nothing static to serve first; a blocking render is the shorter path.
 */
export const instant = false;

export default function Page({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  return (
    <div className="page frame manage">
      <Manage params={params} searchParams={searchParams} />
    </div>
  );
}
