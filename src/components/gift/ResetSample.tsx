"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { giftText, type Lang } from "@/lib/i18n/gift";

/** Lets a judge replay the demo from the start. Only works on the sample household. */
export function ResetSample({ slug, lang = "en" }: { slug: string; lang?: Lang }) {
  const t = giftText(lang);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (slug !== "maya") return null;
  return (
    <button
      type="button"
      className="reset-btn"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/demo/reset", { method: "POST" });
        setBusy(false);
        router.refresh();
      }}
    >
      {busy ? t.resetting : t.reset}
    </button>
  );
}
