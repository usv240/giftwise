/**
 * Read a dollar amount the way people type it: "1,000", "$300", "1 000", "$1,234.56", "300 dollars", "1.5k".
 * Returns null when there is no number in the text, so a form can ask again instead of quietly using $0
 * (a $0 gift always "keeps her check", which would read as good news for an amount it never saw).
 */
export function parseDollars(raw: string): number | null {
  // Commas, spaces and underscores only group digits in US amounts, so they go first: "1,000" and "1 000" are 1000.
  const text = raw.replace(/[\s,_ ]/g, "").toLowerCase();
  const m = text.match(/(\d+(?:\.\d*)?|\.\d+)(k)?/);
  if (!m) return null;
  const n = Number(m[1]) * (m[2] ? 1000 : 1);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

/** An optional money field: empty means $0, text with no number in it is still a mistake to point out. */
export function parseOptionalDollars(raw: string): number | null {
  return raw.trim() === "" ? 0 : parseDollars(raw);
}
