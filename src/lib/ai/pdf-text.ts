/**
 * The text layer of a PDF, for checking that each quote Claude gives is really in the letter. Read in memory with
 * unpdf (PDF.js, serverless build); nothing is written to disk. A scan or photo saved as a PDF has no text layer, and a
 * PDF that cannot be opened returns null too: the quotes are then shown without that check, and say so.
 */
const MAX_PAGES = 6;

export async function pdfText(buf: Buffer | Uint8Array): Promise<string | null> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    if (pdf.numPages > MAX_PAGES) return null;
    const { text } = await extractText(pdf, { mergePages: true });
    const out = text.replace(/\s+/g, " ").trim();
    return out.length >= 20 ? out : null;
  } catch {
    return null;
  }
}
