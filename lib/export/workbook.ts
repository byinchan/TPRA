// The assessment workbook as plain tables of text. Pure: every figure comes from computeOutcome (the same
// function screen 3 and the PDF use); nothing is recalculated here. Only an approved report can be exported.
import { effectiveDecision } from "../ddq.ts";
import { rateIra } from "../ira.ts";
import { computeOutcome } from "../outcome.ts";
import { approvalStatus } from "../report/state.ts";
import { IRA_QUESTIONS, SAMPLES } from "../sample.ts";
import type { AssessmentState } from "../session.ts";

export const SHEET_NAMES = ["Inherent Risk", "Due Diligence", "Findings"] as const;

export interface SheetTable {
  name: (typeof SHEET_NAMES)[number];
  /** Row 1 of `rows` is a header (or a field/value pair list for summaries); every cell is text. */
  rows: string[][];
  /** Index of the first row that is a column header, for bold styling. */
  headerRows: number[];
  widths: number[];
}

const date = (d: string | null) => d ?? "";

/** null unless the report is approved and still matches the data (same gate as Download PDF). */
export function buildWorkbookTables(state: AssessmentState): SheetTable[] | null {
  if (approvalStatus(state) !== "approved" || !state.report) return null;
  const o = computeOutcome(state);
  const sample = SAMPLES[state.sampleId]!;
  const rated = rateIra(state.ira);
  const approved = state.report.approved!;

  const summary: string[][] = [
    ["Vendor", sample.vendor],
    ["Service", sample.service],
    ["Assessed on", state.assessedOn],
    ["Prepared by", state.report.preparer],
    ["Approved", `${approved.by}, ${approved.at}`],
    ["Recommendation", o.recommendationLine],
    ["Inherent risk", `${o.inherent.level} (${o.tier.label})`],
    ["Inherent risk rule", o.inherent.reason],
    ["Questionnaire depth", o.tier.depth],
    ["Reassessment cadence", o.tier.cadence],
    ["FIPPA flag", `${o.fippa.triggered ? "Triggered" : "Checked, not triggered"}. ${o.fippa.reason}`],
    ["Control strength", `${o.strength.strength ?? ""}. ${o.strength.reason}`],
    ["Residual risk", o.residual ? `${o.residual.level}${o.residual.provisional ? " (provisional)" : ""}. ${o.residual.reason}` : ""],
    ["Next review date", date(o.nextReview) || "At contract renewal"],
    ["Note", "AI-assisted, human-reviewed. Fictional organization. Not legal advice."],
    ["Disclaimer", sample.disclaimer],
  ];
  const iraHeader = ["ID", "Area", "Question", "Answer", "Rating", "Answer in loaded sample", "Follow-up open", "Change reason", "Note"];
  const ira = state.ira.map((r) => {
    const q = IRA_QUESTIONS.find((x) => x.id === r.id)!;
    return [
      r.id,
      q.area,
      q.question,
      r.answer,
      rated.find((x) => x.id === r.id)!.rating,
      r.loadedAnswer,
      r.answer === "Unknown" ? "Yes" : "No",
      r.history.at(-1)?.reason ?? "",
      q.addedAfterV1 ? "Added after v1, not in the manual assessment" : "",
    ];
  });

  const ddqHeader = ["ID", "Domain", "Question", "Vendor response", "AI-suggested rating", "AI rationale", "Final rating", "Analyst note", "Evidence to request", "Override reason", "Status"];
  const ddq = state.ddq.map((r) => {
    const d = effectiveDecision(r);
    const meta = sample.ddq.find((x) => x.id === r.id)!;
    return [
      r.id,
      meta.domain,
      meta.question,
      r.response,
      r.ai?.rating ?? "",
      r.ai?.rationale ?? "",
      r.confirmed && d ? d.rating : "",
      r.confirmed && d ? d.note : "",
      d?.evidence ?? "",
      r.overrideReason ?? "",
      r.confirmed ? "Confirmed" : "Awaiting review",
    ];
  });

  const findHeader = ["ID", "Kind", "Title", "Source row", "Owner", "Due date", "Status", "Closing note"];
  const findings = o.findings.map((f) => [f.id, f.kind, f.title, f.sourceRow, f.owner, date(f.dueDate), f.status, f.closeNote ?? ""]);

  return [
    { name: "Inherent Risk", rows: [...summary, [], iraHeader, ...ira], headerRows: [summary.length + 1], widths: [24, 22, 60, 14, 12, 22, 14, 40, 36] },
    { name: "Due Diligence", rows: [ddqHeader, ...ddq], headerRows: [0], widths: [10, 26, 50, 60, 16, 50, 16, 50, 40, 36, 16] },
    { name: "Findings", rows: [findHeader, ...findings], headerRows: [0], widths: [16, 16, 60, 12, 26, 12, 10, 50] },
  ];
}

export function workbookFileName(state: AssessmentState): string {
  const vendor = SAMPLES[state.sampleId]!.vendor.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `TPRA-${vendor}-${state.assessedOn}.xlsx`;
}
