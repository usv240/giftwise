/**
 * Shared pieces for the share images (Open Graph): the brand fonts, the palette, and the frame every card uses.
 * The renderer (next/og) reads TrueType, so src/app/fonts/og holds TTF copies of the site's Clash Grotesk.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactNode } from "react";

export const OG_SIZE = { width: 1200, height: 630 };

/** The light theme's tokens, from globals.css. */
export const C = { bg: "#f4f5f8", surface: "#ffffff", ink: "#21232e", muted: "#5a5d6b", accent: "#105bff", positive: "#17734a", line: "#e6e8ee" };

export async function ogFonts() {
  const dir = join(process.cwd(), "src/app/fonts/og");
  const [regular, medium] = await Promise.all([readFile(join(dir, "ClashGrotesk-400.ttf")), readFile(join(dir, "ClashGrotesk-500.ttf"))]);
  return [
    { name: "Clash", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Clash", data: medium, weight: 500 as const, style: "normal" as const },
  ];
}

/** The card: the Giftwise mark at the top, the content, and one plain line at the foot. */
export function OgFrame({ children, foot }: { children: ReactNode; foot: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: C.bg, padding: "56px 64px", fontFamily: "Clash", color: C.ink }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontWeight: 500 }}>
        <div style={{ width: 26, height: 26, borderRadius: 13, background: C.accent }} />
        Giftwise
      </div>
      <div style={{ display: "flex", flex: 1, marginTop: 28 }}>{children}</div>
      <div style={{ display: "flex", fontSize: 24, color: C.muted }}>{foot}</div>
    </div>
  );
}
