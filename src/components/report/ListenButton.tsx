"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";
const subscribe = () => () => {};

/**
 * Read the Easy Read report aloud with the browser's own voice, in the page's language, one line at a time, so each
 * idea is heard as it is read. Nothing leaves the browser. Hidden where the browser cannot speak.
 */
export function ListenButton({ lines, lang, labels }: { lines: string[]; lang: "en" | "es"; labels: { listen: string; stop: string } }) {
  const supported = useSyncExternalStore(subscribe, canSpeak, () => false);
  const [speaking, setSpeaking] = useState(false);
  const stopped = useRef(false);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  if (!supported) return null;

  const voiceFor = () => {
    const want = lang === "es" ? "es" : "en";
    const voices = window.speechSynthesis.getVoices();
    return voices.find((v) => v.lang.toLowerCase().startsWith(`${want}-us`)) ?? voices.find((v) => v.lang.toLowerCase().startsWith(want)) ?? null;
  };

  const start = () => {
    const synth = window.speechSynthesis;
    synth.cancel();
    stopped.current = false;
    setSpeaking(true);
    const voice = voiceFor();
    lines.forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === "es" ? "es-US" : "en-US";
      if (voice) u.voice = voice;
      u.rate = 0.92;
      if (i === lines.length - 1) u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      synth.speak(u);
    });
  };
  const stop = () => {
    stopped.current = true;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  return (
    <button type="button" className="btn btn-quiet er-listen" onClick={speaking ? stop : start} aria-pressed={speaking}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
        {speaking ? <path d="M16 9.5l5 5M21 9.5l-5 5" /> : <path d="M15.5 9a4 4 0 0 1 0 6M18.2 6.5a7.5 7.5 0 0 1 0 11" />}
      </svg>
      {speaking ? labels.stop : labels.listen}
    </button>
  );
}
