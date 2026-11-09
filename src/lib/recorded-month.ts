import recorded from "../../content/sample-receipt.json";
import { incomeMonth } from "./time";

/**
 * The month of the recorded sandbox order (content/sample-receipt.json), as YYYY-MM, and its name. The sample page's
 * report for this month lists that order's real PayPal captures (src/lib/report/data.ts), each dated in Pacific time
 * (src/lib/time.ts), so every link that opens a
 * report to check it against PayPal opens this month. No database here: the tour in the browser reads it too.
 */
export const RECORDED_MONTH = incomeMonth(recorded.captured_at);
export const RECORDED_MONTH_NAME = new Date(`${RECORDED_MONTH}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
/** Maya's report for that month, at its check section. */
export const RECORDED_REPORT_CHECK = `/g/maya/report?month=${RECORDED_MONTH}#rp-verify-h`;
