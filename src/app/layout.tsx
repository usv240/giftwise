import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { PREFS_SCRIPT, PrefsProvider } from "@/components/prefs";
import { Reveal } from "@/components/Reveal";
import { StackStrip } from "@/components/StackStrip";
import { Tour } from "@/components/tour/Tour";
import "./globals.css";
import "./site.css";
import "./components.css";

const clash = localFont({
  src: [
    { path: "./fonts/ClashGrotesk-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ClashGrotesk-500.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-clash",
  display: "swap",
});

export const metadata: Metadata = {
  // Render sets RENDER_EXTERNAL_URL to the service's public address.
  metadataBase: new URL(process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000"),
  title: { default: "Giftwise: give so she keeps her full check", template: "%s | Giftwise" },
  description:
    "Giftwise checks every gift against Social Security's rules and pays the shop directly through PayPal, so a person on SSI keeps her full benefits.",
};

export const viewport: Viewport = {
  // Light is the default theme; Dark and System are a choice in the Display menu.
  themeColor: "#f4f5f8",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={clash.variable} data-theme="light" data-text="standard" data-labels="off" data-mode="plain" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_SCRIPT }} />
      </head>
      <body>
        <PrefsProvider>
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <Header />
          <main id="main">{children}</main>
          <StackStrip />
          <Footer />
          <Suspense fallback={null}>
            <Reveal />
          </Suspense>
          <Suspense fallback={null}>
            <Tour />
          </Suspense>
        </PrefsProvider>
      </body>
    </html>
  );
}
