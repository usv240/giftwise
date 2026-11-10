import type { Pronoun } from "@/lib/rules";
import { ANSWER_KEYS, type Answers } from "@/lib/situation";

/**
 * The page being started on /start, carried to the form that makes it (/try): the name, the pronoun, and the person's
 * situation as answered. It stays in this browser tab only (sessionStorage) and leaves it only when the page is made.
 * Storage can be blocked; then the page is made with the sample situation, which it names, and the organizer can add
 * the facts on the page's private link.
 */
export type StartDraft = { name: string; pronoun: Pronoun; answers: Answers; source: "answers" | "letter" };

const KEY = "gw-start-page";

export function saveStartDraft(d: StartDraft) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // Storage blocked: the page is made with the sample situation, and says so.
  }
}

/** The draft for this name, if one was started in this tab and its answers still read as answers. */
export function readStartDraft(name?: string): StartDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<StartDraft>;
    if (typeof d.name !== "string" || !["she", "he", "they"].includes(String(d.pronoun))) return null;
    if (name !== undefined && d.name.trim().toLowerCase() !== name.trim().toLowerCase()) return null;
    const answers: Answers = {};
    for (const k of ANSWER_KEYS) if (d.answers && (d.answers as Record<string, unknown>)[k] !== undefined) (answers as Record<string, unknown>)[k] = (d.answers as Record<string, unknown>)[k];
    return { name: d.name, pronoun: d.pronoun as Pronoun, answers, source: d.source === "letter" ? "letter" : "answers" };
  } catch {
    return null;
  }
}

export function clearStartDraft() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
