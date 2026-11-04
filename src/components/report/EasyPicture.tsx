import type { Picture } from "@/lib/report/easy";

/**
 * The pictures beside Easy Read sentences: one plain line drawing per idea, in the text colour, so they hold in light,
 * dark and print. They support the words and are hidden from screen readers, which read the sentence itself.
 */
const PATHS: Record<Picture, React.ReactNode> = {
  ok: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m7.8 12.2 2.9 2.9 5.5-6" />
    </>
  ),
  phone: <path d="M7 3.5h2.4l1.5 4.1-2 1.3a11.5 11.5 0 0 0 6.2 6.2l1.3-2 4.1 1.5V17a2.5 2.5 0 0 1-2.7 2.5A16 16 0 0 1 4.5 6.2 2.5 2.5 0 0 1 7 3.5Z" />,
  check: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="1.5" />
      <path d="M6 10h6M6 14h4" />
      <circle cx="16.5" cy="12" r="2.2" />
    </>
  ),
  shop: (
    <>
      <path d="M3.5 9 5 4.5h14L20.5 9" />
      <path d="M3.5 9h17v1.2a2.6 2.6 0 0 1-4.25 2 2.6 2.6 0 0 1-4.25 0 2.6 2.6 0 0 1-4.25 0 2.6 2.6 0 0 1-4.25-2Z" />
      <path d="M5 12.5V20h14v-7.5M10 20v-4.5h4V20" />
    </>
  ),
  able: (
    <>
      <path d="m3.5 9.5 8.5-5 8.5 5" />
      <path d="M5.5 10v7M9.8 10v7M14.2 10v7M18.5 10v7M3.5 19.5h17" />
    </>
  ),
  cash: (
    <>
      <rect x="2.5" y="6.5" width="19" height="11" rx="1.5" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 9.5v5M18 9.5v5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="1.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  paper: (
    <>
      <path d="M6 3h8.5L18 6.5V21H6Z" />
      <path d="M14 3v4h4M9 11.5h6M9 15h6M9 18.5h3.5" />
    </>
  ),
  savings: (
    <>
      <ellipse cx="12" cy="6" rx="6.5" ry="2.6" />
      <path d="M5.5 6v4c0 1.4 2.9 2.6 6.5 2.6s6.5-1.2 6.5-2.6V6" />
      <path d="M5.5 10v4c0 1.4 2.9 2.6 6.5 2.6s6.5-1.2 6.5-2.6v-4" />
      <path d="M5.5 14v4c0 1.4 2.9 2.6 6.5 2.6s6.5-1.2 6.5-2.6v-4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.4 2.1" />
    </>
  ),
  help: (
    <>
      <path d="M4 5.5h16v10.5h-8l-4.5 3.5V16H4Z" />
      <path d="M10 9a2 2 0 1 1 2.6 1.9c-.4.2-.6.5-.6.9v.4M12 14h.01" />
    </>
  ),
  id: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="1.5" />
      <circle cx="8.5" cy="10.5" r="2" />
      <path d="M5.5 15.8c.7-1.5 1.8-2.2 3-2.2s2.3.7 3 2.2M14.5 10h4M14.5 13.5h4" />
    </>
  ),
};

export function EasyPicture({ name }: { name: Picture }) {
  return (
    <svg className="er-pic" viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
