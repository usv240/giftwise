import Kernel from "@onkernel/sdk";

export type PageRead = { text: string; title: string; via: "kernel" | "fetch" | "bundled"; liveViewUrl?: string; sessionId?: string };

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Only public http(s) pages; no private network addresses. */
export function safePublicUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (!/^https?:$/.test(u.protocol)) return null;
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1)/i.test(u.hostname) && process.env.NODE_ENV === "production") return null;
    return u;
  } catch {
    return null;
  }
}

/**
 * The sample fundraiser this site ships (public/samples/*.html), read from disk instead of over the network, so the
 * sample works the same on any host and the server never has to fetch its own address.
 */
export async function readBundledSample(pathname: string): Promise<PageRead | null> {
  const m = /^\/samples\/([a-z0-9-]+\.html)$/.exec(pathname);
  if (!m) return null;
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const html = await readFile(join(process.cwd(), "public", "samples", m[1]), "utf8").catch(() => null);
  if (html === null) return null;
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "";
  return { text: stripHtml(html).slice(0, 60000), title, via: "bundled" };
}

/**
 * Read a fundraiser page. KERNEL's cloud browser renders JavaScript-heavy pages; a plain fetch is the
 * fallback for static pages and for when KERNEL is not configured.
 */
export async function readPage(url: URL): Promise<PageRead> {
  if (process.env.KERNEL_API_KEY && process.env.FALLBACK_KERNEL !== "true") {
    const kernel = new Kernel();
    const browser = await kernel.browsers.create({ timeout_seconds: 120 });
    try {
      const r = await kernel.browsers.playwright.execute(browser.session_id, {
        code: `await page.goto(${JSON.stringify(url.toString())}, { waitUntil: 'networkidle', timeout: 30000 });
return { title: await page.title(), text: (await page.evaluate(() => document.body.innerText)).slice(0, 60000) };`,
        timeout_sec: 60,
      });
      if (r.success && r.result && typeof r.result === "object") {
        const res = r.result as { title?: string; text?: string };
        return { text: res.text ?? "", title: res.title ?? "", via: "kernel", liveViewUrl: browser.browser_live_view_url, sessionId: browser.session_id };
      }
    } finally {
      await kernel.browsers.deleteByID(browser.session_id).catch(() => undefined);
    }
  }
  const res = await fetch(url, { headers: { "User-Agent": "GiftwiseBot/1.0 (+https://github.com/usv240/giftwise)" }, signal: AbortSignal.timeout(15000) });
  const html = await res.text();
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "";
  return { text: stripHtml(html).slice(0, 60000), title, via: "fetch" };
}
