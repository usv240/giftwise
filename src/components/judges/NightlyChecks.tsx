import { CASES } from "@/lib/cases/list";
import { API, NIGHTLY_UTC, PATH } from "../../../workflows/src/checks";
import { NightlyLive } from "./NightlyLive";

/**
 * The latest outside check: what Render Workflows ran against the hosted site, and a button to run it again. The page
 * around it is static, so the run is read in the browser from GET /api/checks/latest. The list it compares the run with
 * is the one the workflow runs today (workflows/src/checks.ts and the app's failure cases).
 */
export function NightlyChecks() {
  const current = [
    ...CASES.map((c) => ({ id: `case:${c.id}`, title: c.title })),
    ...PATH.map((p) => ({ id: `path:${p.id}`, title: p.title })),
    ...API.map((a) => ({ id: `api:${a.id}`, title: a.title })),
  ];
  const nightly = `${String(NIGHTLY_UTC.hour).padStart(2, "0")}:${String(NIGHTLY_UTC.minute).padStart(2, "0")} UTC`;
  return <NightlyLive current={current} nightly={nightly} />;
}
