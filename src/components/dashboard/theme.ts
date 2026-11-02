import { studioTheme } from "ag-studio";

// AG Studio theme for the family dashboard. Every value points at a Giftwise design token (src/app/globals.css),
// so Studio follows the site's light and dark themes without its own copy of the colors.
const token = (name: string) => `var(--${name})`;
// Second series is orange, so "if it had been cash" never reads as the good line.
const SERIES = ["accent", "mark", "positive", "tint-blue-ink", "attention", "muted"];
const palette = Object.fromEntries(
  Array.from({ length: 10 }, (_, i) => [
    [`chartPaletteFills${i + 1}Color`, token(SERIES[i % SERIES.length])],
    [`chartPaletteStrokes${i + 1}Color`, token(SERIES[i % SERIES.length])],
  ]).flat(),
);
const FONT = "var(--font-clash), ui-sans-serif, system-ui, sans-serif";

export const giftwiseTheme = studioTheme.withParams({
  fontFamily: FONT,
  fontSize: 14,
  textColor: token("ink"),
  foregroundColor: token("ink"),
  subtleTextColor: token("muted"),
  backgroundColor: token("surface"),
  borderColor: token("surface-2"),
  accentColor: token("accent"),
  iconColor: token("muted"),
  rowHoverColor: token("surface-2"),

  // The canvas is the page itself; widgets are the site's cards.
  studioWrapperBorder: false,
  studioWrapperBorderRadius: 0,
  studioWrapperSpacing: 0,
  studioWrapperBackgroundColor: token("bg"),
  studioCanvasBorder: false,
  studioCanvasBorderRadius: 0,
  studioCanvasShadow: false,
  studioCanvasBackgroundColor: token("bg"),
  studioCanvasPadding: 0,
  studioCanvasRowHeight: 18,
  studioCanvasFontFamily: FONT,
  studioWidgetBackgroundColor: token("surface"),
  studioWidgetBorder: false,
  studioWidgetBorderRadius: 20,
  studioWidgetPadding: 14,
  studioWidgetTitleFontFamily: FONT,
  studioWidgetTitleFontSize: 15,
  studioWidgetTitleFontWeight: 500,
  studioWidgetTitleTextColor: token("ink"),
  studioWidgetSubtitleFontFamily: FONT,
  studioWidgetSubtitleFontSize: 13,
  studioWidgetSubtitleTextColor: token("muted"),
  studioWidgetCaptionFontFamily: FONT,
  studioWidgetCaptionFontSize: 13,
  studioWidgetCaptionTextColor: token("muted"),
  studioWidgetResizeBorderColor: token("accent"),
  studioPanelContainerBackgroundColor: token("surface"),
  studioPanelHeaderFontFamily: FONT,
  studioToggleButtonActiveBackgroundColor: token("tint-blue"),
  studioToggleButtonActiveBorderColor: token("accent"),
  studioToggleButtonActiveColor: token("tint-blue-ink"),

  gridFontFamily: FONT,
  gridFontSize: 14,
  gridCellTextColor: token("ink"),
  gridHeaderBackgroundColor: token("surface"),
  gridHeaderTextColor: token("muted"),
  gridHeaderFontWeight: 500,
  gridHeaderFontSize: 13,
  gridRowHeight: 40,
  gridRowHoverColor: token("surface-2"),
  gridWrapperBorder: false,

  chartFontFamily: FONT,
  chartTextColor: token("ink"),
  chartSubtleTextColor: token("muted"),
  chartAxisLineColor: token("surface-2"),
  chartGridLineColor: token("surface-2"),
  ...palette,
});
