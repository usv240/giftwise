// Stands in for "@bryntum/calendar" in the bundle (see turbopack.resolveAlias in next.config.ts). The browser loads
// Bryntum's UMD build from /bryntum/calendar.umd.js first (ensureBryntumScript), which defines window.bryntum.calendar;
// this hands those exports to BenefitCalendar and @bryntum/calendar-react. Types still come from the real package.
module.exports = (typeof globalThis !== "undefined" && globalThis.bryntum && globalThis.bryntum.calendar) || {};
