// The assessment workbook as plain tables of text. Pure: every figure comes from computeOutcome (the same
// function screen 3 and the PDF use); nothing is recalculated here. Only an approved report can be exported.
import { effectiveDecision } from "../ddq.ts";
import { rateIra } from "../ira.ts";
import { computeOutcome } from "../outcome.ts";
import { approvalStatus } from "../report/state.ts";
import { IRA_QUESTIONS, SAMPLES } from "../sample.ts";
import type { AssessmentState } from "../session.ts";

export const SHEET_NAMES = ["Summary", "Inherent Risk", "Due Diligence", "Findings", "Audit trail"] as const;
export const MAX_COL_WIDTH = 45;

export interface SheetTable {
  name: (typeof SHEET_NAMES)[number];
  /** Row 0 is the frozen header row (the title on Summary); every cell is text. */
  rows: string[][];
  /** Summary: rows after the title are label/value pairs and the first column is bold. */
  labelColumn: boolean;
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
  const open = o.findings.filter((f) => f.status === "Open").length;

  const summary: string[][] = [
    [`Third-Party Risk Assessment – ${sample.vendor}`, ""],
    ["Vendor", sample.vendor],
    ["Service", sample.service],
    ["Assessed on", state.assessedOn],
    ["Prepared by", state.report.preparer],
    ["Approved", `${approved.by} on ${approved.at.slice(0, 10)}`],
    ["Recommendation", o.recommendation!.decision],
    ["Inherent risk", `${o.inherent.level} (${o.tier.label})`],
    ["Control strength", o.strength.strength ?? ""],
    ["Residual risk", o.residual ? `${o.residual.level}${o.residual.provisional ? " (provisional)" : ""}` : ""],
    ["FIPPA status", o.fippa.triggered ? "Triggered: confirm with Privacy Office" : "Checked, not triggered"],
    ["Next review date", date(o.nextReview) || "At contract renewal"],
    ["Open findings", String(open)],
    ["Note", `AI-assisted, human-reviewed. Fictional organization. ${sample.disclaimer}`],
  ];

  const ira = state.ira.map((r) => {
    const q = IRA_QUESTIONS.find((x) => x.id === r.id)!;
    return [q.area, q.question, r.answer, rated.find((x) => x.id === r.id)!.rating];
  });

  const ddq = state.ddq.map((r) => {
    const d = effectiveDecision(r);
    const meta = sample.ddq.find((x) => x.id === r.id)!;
    return [meta.domain, meta.question, r.response, r.confirmed && d ? d.rating : "", r.confirmed && d ? d.note : "", d?.evidence ?? ""];
  });

  const findings = o.findings.map((f) => [f.id, f.kind, f.title, f.owner, date(f.dueDate), f.status]);

  const audit: string[][] = [["Record", "ID", "AI-suggested rating", "AI rationale", "Override reason", "Status", "Note"]];
  for (const r of state.ddq) {
    audit.push(["Due diligence row", r.id, r.ai?.rating ?? "", r.ai?.rationale ?? "", r.overrideReason ?? "", r.confirmed ? "Confirmed" : "Awaiting review", ""]);
  }
  for (const r of state.ira) {
    const last = r.history.at(-1);
    if (last) audit.push(["IRA answer change", r.id, "", "", "", `${last.from} to ${last.to}`, last.reason]);
  }
  const rule = (id: string, text: string) => audit.push(["Rule applied", id, "", "", "", "", text]);
  rule("Inherent risk", o.inherent.reason);
  rule("Tier", `${o.tier.label}: ${o.tier.depth}; review ${o.tier.cadence}`);
  rule("Control strength", o.strength.reason);
  if (o.residual) rule("Residual risk", o.residual.reason);
  rule("FIPPA flag", o.fippa.reason);
  if (o.recommendation) rule("Recommendation", o.recommendation.reason);
  for (const f of o.findings) if (f.closeNote) audit.push(["Finding closing note", f.id, "", "", "", f.status, f.closeNote]);

  return [
    { name: "Summary", rows: summary, labelColumn: true, widths: [24, 45] },
    { name: "Inherent Risk", rows: [["Area", "Question", "Answer", "Rating"], ...ira], labelColumn: false, widths: [22, 45, 12, 12] },
    {
      name: "Due Diligence",
      rows: [["Domain", "Question", "Vendor response", "Final rating", "Analyst note", "Evidence to request"], ...ddq],
      labelColumn: false,
      widths: [24, 40, 45, 16, 40, 40],
    },
    { name: "Findings", rows: [["ID", "Type", "Title", "Owner", "Due date", "Status"], ...findings], labelColumn: false, widths: [16, 16, 45, 26, 12, 10] },
    { name: "Audit trail", rows: audit, labelColumn: false, widths: [22, 18, 18, 45, 30, 18, 45] },
  ];
}

export function workbookFileName(state: AssessmentState): string {
  const vendor = SAMPLES[state.sampleId]!.vendor.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `TPRA-${vendor}-${state.assessedOn}.xlsx`;
}
