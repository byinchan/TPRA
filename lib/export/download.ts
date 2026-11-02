// Browser-only: turns the workbook tables into an .xlsx and saves it. The workbook is generated in the tab;
// nothing is sent to a server. Loaded on demand so the library is not part of the initial page.
import type { AssessmentState } from "../session.ts";
import { buildWorkbookTables, workbookFileName } from "./workbook.ts";

export async function downloadWorkbook(state: AssessmentState): Promise<void> {
  const tables = buildWorkbookTables(state);
  if (!tables) throw new Error("Approve the report before exporting.");
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const sheets = tables.map((t) => ({
    sheet: t.name,
    data: t.rows.map((row, i) =>
      row.map((value) =>
        value === "" ? null : { value, type: String, wrap: true, fontWeight: t.headerRows.includes(i) ? ("bold" as const) : undefined },
      ),
    ),
    columns: t.widths.map((width) => ({ width })),
    stickyRowsCount: t.name === "Inherent Risk" ? 0 : 1,
  }));
  await writeXlsxFile(sheets).toFile(workbookFileName(state));
}
