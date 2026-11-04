/**
 * Load Bryntum Calendar's UMD build as a plain script, once. It defines window.bryntum.calendar, which the bundle reads
 * through bryntum-global.cjs. It is kept out of the bundle because Turbopack cannot analyse the 5 MB trial bundle
 * within Render's build memory (scripts/vendor-bryntum.mjs).
 */
let bryntumScript: Promise<void> | null = null;
export function ensureBryntumScript(): Promise<void> {
  const g = globalThis as { bryntum?: { calendar?: unknown } };
  if (g.bryntum?.calendar) return Promise.resolve();
  bryntumScript ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "/bryntum/calendar.umd.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      bryntumScript = null;
      s.remove();
      reject(new Error("The calendar could not load. Please reload the page."));
    };
    document.head.appendChild(s);
  });
  return bryntumScript;
}

/**
 * Put the matching Bryntum theme on the page before Bryntum's code loads. Bryntum checks for a theme soon after it loads
 * and, finding none, fetches one from its CDN, so the theme must already be there.
 */
export function ensureBryntumTheme(): Promise<void> {
  const html = document.documentElement;
  const href = `/vendor/bryntum/stockholm-${html.dataset.theme === "dark" ? "dark" : "light"}.css`;
  let link = document.getElementById("bryntum-theme") as HTMLLinkElement | null;
  if (link && link.getAttribute("href") === href && link.sheet) return Promise.resolve();
  if (!link) {
    link = document.createElement("link");
    link.id = "bryntum-theme";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  const el = link;
  return new Promise((resolve) => {
    const done = () => resolve();
    el.addEventListener("load", done, { once: true });
    el.addEventListener("error", done, { once: true });
    if (el.getAttribute("href") !== href) el.setAttribute("href", href);
    else if (el.sheet) resolve();
  });
}
