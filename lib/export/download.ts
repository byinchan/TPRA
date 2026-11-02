// Browser-only: turns the workbook tables into an .xlsx and saves it. The workbook is generated in the tab;
// nothing is sent to a server. Loaded on demand so the library is not part of the initial page.
import type { AssessmentState } from "../session.ts";
import { buildWorkbookTables, workbookFileName, type SheetTable } from "./workbook.ts";

export async function downloadWorkbook(state: AssessmentState): Promise<void> {
  const tables = buildWorkbookTables(state);
  if (!tables) throw new Error("Approve the report before exporting.");
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const sheets = buildSheets(tables);
  await writeXlsxFile(sheets).toFile(workbookFileName(state));
}

const HEADER_FILL = "#E7E5E4";

/** Header row bold with a light fill, wrapped and top-aligned text, frozen header row, fixed widths. */
export function buildSheets(tables: SheetTable[]) {
  return tables.map((t) => ({
    sheet: t.name,
    data: t.rows.map((row, i) =>
      row.map((value, c) =>
        value === ""
          ? i === 0
            ? { backgroundColor: HEADER_FILL }
            : null
          : {
              value,
              type: String,
              wrap: !(t.labelColumn && i === 0),
              alignVertical: "top" as const,
              fontWeight: i === 0 || (t.labelColumn && c === 0) ? ("bold" as const) : undefined,
              backgroundColor: i === 0 ? HEADER_FILL : undefined,
            },
      ),
    ),
    columns: t.widths.map((width) => ({ width })),
    stickyRowsCount: 1,
  }));
}
