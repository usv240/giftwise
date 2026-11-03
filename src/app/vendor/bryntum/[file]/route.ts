import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Serves the installed Bryntum theme file the page asks for, so the calendar can switch between light and dark with the
 * site. The two theme files both set variables on :root, so only one can be loaded at a time; they are read from the
 * installed package, not copied into the repository.
 */
const THEMES = new Set(["stockholm-light.css", "stockholm-dark.css"]);

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!THEMES.has(file)) return new Response("Not found", { status: 404 });
  const css = await readFile(path.join(process.cwd(), "node_modules", "@bryntum", "calendar", file), "utf8");
  return new Response(css, { headers: { "content-type": "text/css; charset=utf-8", "cache-control": "public, max-age=86400" } });
}
