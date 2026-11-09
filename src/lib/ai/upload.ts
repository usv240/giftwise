import { createHash } from "node:crypto";
import sharp from "sharp";

/** A document as Claude is sent it, named by the SHA-256 of the file the visitor sent (the replay key uses that name). */
export type PreparedFile = { base64: string; mediaType: string; fileSha256: string };

/**
 * An upload as /api/v1/read-bill sends it, and the sample bill the same way: a PDF as it came; an image re-encoded by
 * sharp to a JPEG within 1600 px, which strips EXIF location data and any embedded payloads and keeps the size sensible.
 * Throws when sharp cannot open the image.
 */
export async function prepareFile(buf: Buffer, type: string): Promise<PreparedFile> {
  const fileSha256 = createHash("sha256").update(buf).digest("hex");
  if (type === "application/pdf") return { base64: buf.toString("base64"), mediaType: "application/pdf", fileSha256 };
  const out = await sharp(buf).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  return { base64: out.toString("base64"), mediaType: "image/jpeg", fileSha256 };
}
