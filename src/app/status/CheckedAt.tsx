import { shownTime } from "@/lib/time";

/** The time the checks ran, in Pacific time with the zone named, the one zone every time on the site is shown in (src/lib/time.ts). */
export function CheckedAt({ iso }: { iso: string }) {
  return <time dateTime={iso}>{shownTime(iso, { seconds: true })}</time>;
}
