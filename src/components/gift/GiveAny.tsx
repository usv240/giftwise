"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { Info } from "../Info";
import { usePrefs } from "../prefs";
import { DEFAULT_GIFT, MAX_GIFT, asTyped, readAmount, suggestedAmounts, type Chip } from "./amount";
import { StartMonthly } from "./MonthlyActions";
import { PayPalPay, requestOrder, type Receipt } from "./PayPalPay";
import { routeGift, type OpenNeed, type RoutedGift } from "@/lib/routing";
import { DEFAULT_PROFILE, P, addMonths, monthOf, pronounWords, usd, type Profile } from "@/lib/rules";
import { checkMonthIn, giftText, monthIn, payeeIn, payeeInline, type Lang } from "@/lib/i18n/gift";

/**
 * "Give any amount": the donor types a number; the rules engine routes it across the open needs and the ABLE account,
 * and one PayPal checkout pays every recipient directly.
 */

/** Shop segments step through shades of the site's green; the ABLE account keeps the accent. */
const tone = (i: number) => `color-mix(in oklab, var(--positive) ${[100, 74, 56, 42, 32][i % 5]}%, var(--surface))`;
/** Her check as a share of the check with no gift, for the meter. */
const share = (check: number, baseline: number) => (baseline > 0 ? Math.max(0, Math.min(1, check / baseline)) : 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * `chips` and `firstPlan` (the split of the starting amount) can come from the server, which computes them once for the
 * same needs, date and profile, so the card renders and hydrates without running the router for them again.
 */
export function GiveAny({
  slug,
  name,
  needs,
  date,
  profile = DEFAULT_PROFILE,
  lang = "en",
  chips: givenChips,
  firstPlan,
}: {
  slug: string;
  name: string;
  needs: OpenNeed[];
  date: string;
  profile?: Profile;
  lang?: Lang;
  chips?: Chip[];
  firstPlan?: RoutedGift;
}) {
  const w = pronounWords(profile.pronoun);
  const t = giftText(lang);
  const lineTitle = (ref: string, title: string) => (ref === "able-savings" ? t.savingsLater : title);
  const q = lang === "es" ? "?lang=es" : "";
  const uid = useId();
  const payId = `${uid}-pay`;
  const { prefs } = usePrefs();
  const router = useRouter();
  const ableName = `${name}'s ABLE account`;
  const [raw, setRaw] = useState(String(DEFAULT_GIFT));
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  // The plan the donor saw when they paid. The page refreshes after payment, so `plan` moves on to what is still open.
  const [paidPlan, setPaidPlan] = useState<RoutedGift | null>(null);
  const typed = readAmount(raw);
  const value = typed.kind === "ok" ? typed.value : 0;
  const over = value > MAX_GIFT;
  // Nothing is routed for an amount that cannot be paid, so the page never shows a split that looks payable.
  const payable = value >= 1 && !over;
  const plan = useMemo(
    () => (firstPlan && payable && value === DEFAULT_GIFT ? firstPlan : routeGift(payable ? value : 0, needs, date, profile, ableName)),
    [firstPlan, payable, value, needs, date, profile, ableName],
  );
  const chips = useMemo(() => givenChips ?? suggestedAmounts(needs, date, profile, ableName, giftText(lang).chipAll), [givenChips, needs, date, profile, ableName, lang]);
  const total = round2(plan.lines.reduce((s, l) => s + l.amount, 0));
  const ready = payable && plan.lines.length > 0;
  const giftMonth = monthIn(lang, monthOf(date));
  const checkMonthKey = addMonths(monthOf(date), P.rmaLagMonths);
  const checkMonth = checkMonthIn(lang, checkMonthKey);
  const hint = typed.kind === "invalid" ? t.hintNumber : value < 1 ? t.hintMin : t.unplaced(usd(plan.unplaced));

  if (receipt) {
    const lines = paidPlan?.lines ?? [];
    const titles = new Map(lines.map((l) => [l.referenceId, lineTitle(l.referenceId, l.title)]));
    const order = new Map(lines.map((l, i) => [l.referenceId, i]));
    const captures = [...receipt.captures].sort((a, b) => (order.get(a.reference_id) ?? 99) - (order.get(b.reference_id) ?? 99));
    return (
      <div className="give-any" data-ui role="status">
        <p className="give-done">{t.thanks(receipt.payerFirstName)}</p>
        <p>{t.doneLine(usd(Number(receipt.amount)))}</p>
        <ul className="give-lines">
          {captures.map((c) => (
            <li key={c.reference_id}>
              <span>
                {payeeIn(lang, c.payee)}
                {titles.has(c.reference_id) && <span className="muted"> ({titles.get(c.reference_id)})</span>}
              </span>
              <span className="tabular">{usd(Number(c.amount ?? 0))}</span>
            </li>
          ))}
        </ul>
        {paidPlan && captures.length > 0 && <p className="give-next">{t.paidNext(captures.map((c) => payeeInline(lang, c.payee)), w, checkMonth, usd(paidPlan.baseline))}</p>}
        <p className="give-order tabular">{t.orderLine(receipt.orderId)}</p>
        <p className="give-actions">
          <Link className="text-link" href={`/r/${receipt.orderId}${q}`}>
            {t.seeReceipt}
          </Link>
          <Link className="text-link" href={lang === "es" ? `/g/${slug}/report/easy?month=${date.slice(0, 7)}&lang=es` : `/g/${slug}/report?month=${date.slice(0, 7)}`}>
            {t.seeOnReport(name, monthIn(lang, date.slice(0, 7)))}
          </Link>
          <button type="button" className="give-again" onClick={() => setReceipt(null)}>
            {t.giveAgain}
          </button>
          <StartMonthly lang={lang} slug={slug} amount={Number(receipt.amount)} orderId={receipt.orderId} giverName={receipt.payerFirstName} />
        </p>
      </div>
    );
  }

  return (
    <div className="give-any" data-ui>
      <div className="title-row">
        <h2 className="give-title">{t.giveAny}</h2>
        <Info id="gift.any" label="" topic={t.giveAny} lang={lang} />
      </div>
      <div className="give-chips" role="group" aria-label={t.chips}>
        {chips.map((c) => (
          <button key={c.amount} type="button" className="give-chip" aria-pressed={typed.kind === "ok" && value === c.amount} onClick={() => setRaw(asTyped(c.amount))}>
            <span className="tabular">{usd(c.amount)}</span>
            {c.label && <span className="give-chip-for"> {c.label}</span>}
          </button>
        ))}
      </div>
      <label className="give-field">
        <span>{t.yourGift}</span>
        <span className="give-input-wrap">
          <span aria-hidden="true">$</span>
          <input
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onKeyDown={(e) => {
              // There is no form to send: Enter (Done on a phone keyboard) just closes the keyboard.
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            aria-label={t.yourGiftAria}
            aria-invalid={typed.kind === "invalid" || over ? true : undefined}
            aria-describedby={payId}
            className="give-input tabular"
          />
        </span>
      </label>
      {payable && (
        <>
          <p className="give-k">{t.sendsHere}</p>
          {/* The one number, split: each segment is a recipient, sized by what it receives. The list below carries the same facts for screen readers. */}
          <div className="give-split" aria-hidden="true">
            {plan.lines.map((l, i) => (
              <span key={l.referenceId} className="give-seg" data-able={l.route === "able" ? "" : undefined} style={{ flexGrow: l.amount, ["--tone" as string]: tone(i) }} />
            ))}
            {plan.unplaced > 0 && <span key="unplaced" className="give-seg" data-unplaced="" style={{ flexGrow: plan.unplaced }} />}
          </div>
          <ul className="give-lines" aria-live="polite">
            {plan.lines.map((l, i) => (
              <li key={l.referenceId}>
                <span>
                  <span className="give-swatch" data-able={l.route === "able" ? "" : undefined} style={{ ["--tone" as string]: tone(i) }} aria-hidden="true" />
                  {payeeIn(lang, l.payeeName)} <span className="muted">({lineTitle(l.referenceId, l.title)})</span>
                </span>
                <span className="tabular">{usd(l.amount)}</span>
              </li>
            ))}
          </ul>
          {plan.lines.length > 0 && (
            <>
              <div className="give-check">
                <p className="give-k">{t.checkSetBy(w, checkMonth, giftMonth)}</p>
                <p className="give-verdict tabular">{plan.checkWithRouting === plan.baseline ? t.checkStays(usd(plan.checkWithRouting), checkMonthKey.slice(0, 4)) : t.checkIs(usd(plan.checkWithRouting))}</p>
              </div>
              <div className="give-compare">
                <div>
                  <p className="give-k">{t.asCash}</p>
                  <p className="give-fig tabular">{usd(plan.checkIfCash)}</p>
                  <span className="give-meter" aria-hidden="true">
                    <span className="give-meter-fill" data-cash="" style={{ transform: `scaleX(${share(plan.checkIfCash, plan.baseline)})` }} />
                  </span>
                </div>
                <div>
                  <p className="give-k">{t.withGiftwise}</p>
                  <p className="give-fig tabular" data-kept="">
                    {usd(plan.checkWithRouting)}
                  </p>
                  <span className="give-meter" aria-hidden="true">
                    <span className="give-meter-fill" style={{ transform: `scaleX(${share(plan.checkWithRouting, plan.baseline)})` }} />
                  </span>
                </div>
              </div>
              <p className="give-note">{t.nothingTo(w)}</p>
              {prefs.mode === "technical" && (
                <p className="give-tech">
                  One Orders v2 order with {plan.lines.length} purchase {plan.lines.length === 1 ? "unit" : "units"}, each with its own payee. Rules:{" "}
                  {[...new Set(plan.lines.flatMap((l) => l.ruleIds))].join(", ")}.
                </p>
              )}
              {plan.unplaced > 0 && <p className="give-attention">{t.unplaced(usd(plan.unplaced))}</p>}
            </>
          )}
        </>
      )}
      {/* Right at the button: what this one payment is, or what to type first. The button's description reads it. */}
      {over ? (
        <p key="over" id={payId} className="give-pay" data-tone="alert" role="alert">
          {t.overMax}
        </p>
      ) : ready ? (
        <p key="total" id={payId} className="give-pay">
          {t.payYou} <strong className="tabular">{usd(total)}</strong> {t.payRest(plan.lines.length, payeeInline(lang, plan.lines[0].payeeName))}
        </p>
      ) : (
        <p key="hint" id={payId} className="give-pay" data-tone="hint" role="status">
          {hint}
        </p>
      )}
      <PayPalPay
        lang={lang}
        card
        disabled={!ready}
        describedBy={payId}
        createOrder={() => requestOrder("/api/paypal/gift-orders", { slug, amount: value })}
        onPaid={(r) => {
          setPaidPlan(plan);
          setReceipt(r);
          router.refresh();
        }}
      />
    </div>
  );
}
