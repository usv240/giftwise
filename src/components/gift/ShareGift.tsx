"use client";

import { useState } from "react";
import { giftText, type Lang } from "@/lib/i18n/gift";

/**
 * Share a gift page: the phone's own share sheet where there is one, otherwise copy the link. The QR code is drawn
 * on the server, so a family can print it or hold up a phone at a gathering.
 */
export function ShareGift({ url, title, text, qrSvg, lang = "en" }: { url: string; title: string; text: string; qrSvg: string; lang?: Lang }) {
  const t = giftText(lang);
  const [note, setNote] = useState("");
  async function share() {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setNote(t.copied);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setNote(url);
    }
  }
  return (
    <div className="gift-share" data-ui>
      <p className="gift-share-title">{t.shareTitle}</p>
      <p className="gift-share-text">{t.shareText}</p>
      <div className="gift-share-row">
        <button type="button" className="gift-share-btn" onClick={share}>
          {t.shareBtn}
        </button>
        <span className="gift-share-note" aria-live="polite">
          {note}
        </span>
      </div>
      <details className="gift-share-qr">
        <summary>{t.showQr}</summary>
        <div className="gift-share-qr-img" role="img" aria-label={t.qrAria(url)} dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <p className="gift-share-url">{url.replace(/^https?:\/\//, "")}</p>
      </details>
    </div>
  );
}
