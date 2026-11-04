// Copies Bryntum Calendar's ready-built UMD file into public/, where the calendar page loads it as a plain script.
//
// Bryntum's trial package ships one unminified, obfuscated 5 MB bundle. Turbopack on Linux runs past 8 GB of memory
// analysing it (Render's build limit), whether it is imported as ESM or UMD, so the calendar keeps it out of the
// bundle: the browser loads this file and src/components/calendar/bryntum-global.cjs hands its exports to the code.
// Runs after npm install and before every build.
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "@bryntum", "calendar", "calendar.umd.js");
const to = join(root, "public", "bryntum", "calendar.umd.js");

if (!existsSync(from)) {
  console.warn("vendor-bryntum: @bryntum/calendar is not installed; the calendar page will not load.");
} else if (!existsSync(to) || statSync(to).size !== statSync(from).size || statSync(to).mtimeMs < statSync(from).mtimeMs) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log("vendor-bryntum: copied calendar.umd.js to public/bryntum/");
}
