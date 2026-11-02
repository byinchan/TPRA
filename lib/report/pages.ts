// Page-fit estimate for the print layout (Letter, 0.6in margins, at 96 CSS px per inch). Pure.
export const PRINT = {
  pageHeightIn: 11,
  marginIn: 0.6,
  pxPerIn: 96,
  /** Content width used when measuring: 8.5in minus both margins. */
  contentWidthPx: Math.round((8.5 - 2 * 0.6) * 96),
} as const;

export const MAX_PAGES = 2;

/** Pages needed for content of this rendered height (px) at the print content width. */
export function estimatePages(contentHeightPx: number): number {
  const usable = (PRINT.pageHeightIn - 2 * PRINT.marginIn) * PRINT.pxPerIn;
  return Math.max(1, Math.ceil(contentHeightPx / usable));
}
