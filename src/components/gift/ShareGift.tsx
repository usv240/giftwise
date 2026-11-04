"use client";

import { useState } from "react";

/**
 * Share a gift page: the phone's own share sheet where there is one, otherwise copy the link. The QR code is drawn
 * on the server, so a family can print it or hold up a phone at a gathering.
 */
export function ShareGift({ url, title, text, qrSvg }: { url: string; title: string; text: string; qrSvg: string }) {
  const [note, setNote] = useState("");
  async function share() {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setNote("Link copied");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setNote(url);
    }
  }
  return (
    <div className="gift-share" data-ui>
      <p className="gift-share-title">Share this page</p>
      <p className="gift-share-text">Anyone you send it to gives the same way, straight to the shop.</p>
      <div className="gift-share-row">
        <button type="button" className="gift-share-btn" onClick={share}>
          Share or copy the link
        </button>
        <span className="gift-share-note" aria-live="polite">
          {note}
        </span>
      </div>
      <details className="gift-share-qr">
        <summary>Show a QR code</summary>
        <div className="gift-share-qr-img" role="img" aria-label={`QR code for ${url}`} dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <p className="gift-share-url">{url.replace(/^https?:\/\//, "")}</p>
      </details>
    </div>
  );
}
