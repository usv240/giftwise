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
