import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_NARRATIVES } from "../lib/ai/demo.ts";
import { computeOutcome } from "../lib/outcome.ts";
import { buildWorkbookTables, workbookFileName } from "../lib/export/workbook.ts";
import { validateNarrative } from "../lib/report/schema.ts";
import { applyNarrative, setPreparer, editSection } from "../lib/report/state.ts";
import { approveReport } from "../lib/report/state.ts";
import { setDueDate } from "../lib/findings.ts";
import { standardDemoState } from "../scripts/demo-facts-key.ts";

const AT = "2026-11-02T19:00:00.000Z";

async function approved() {
  let s = await standardDemoState();
  const n = validateNarrative(DEMO_NARRATIVES["v1-deloitte"]!.output)!.narrative;
  s = applyNarrative(s, { ok: true, mode: "demo", demoReason: "requested", demoMatchesFacts: true, source: DEMO_NARRATIVES["v1-deloitte"]!.source, narrative: n, truncated: 0 }, AT);
  for (const f of computeOutcome(s).findings) s = setDueDate(s, f.id, "2027-01-15", AT);
  return { s: setPreparer(s, "B. Chan", AT), n };
}

test("no workbook until the report is approved; any later edit withdraws it", async () => {
  const { s, n } = await approved();
  assert.equal(buildWorkbookTables(s), null);
  const a = approveReport(s, AT);
  assert.ok(buildWorkbookTables(a));
  assert.equal(buildWorkbookTables(editSection(a, "method", n.method + " More.", AT)), null);
});

test("workbook has the three sheets and every figure matches the computed outcome", async () => {
  const { s } = await approved();
  const a = approveReport(s, AT);
  const o = computeOutcome(a);
  const t = buildWorkbookTables(a)!;
  assert.deepEqual(t.map((x) => x.name), ["Inherent Risk", "Due Diligence", "Findings"]);
  const [ira, ddq, fnd] = t as [typeof t[0], typeof t[0], typeof t[0]];
  const field = (k: string) => ira.rows.find((r) => r[0] === k)?.[1];
  assert.equal(field("Recommendation"), o.recommendationLine);
  assert.equal(field("Inherent risk"), `${o.inherent.level} (${o.tier.label})`);
  assert.equal(field("Next review date"), o.nextReview);
  // 16 IRA rows, 26 questionnaire rows, one row per computed finding; all rows are the same width as their header.
  assert.equal(ira.rows.filter((r) => /^IRA-\d\d$/.test(r[0] ?? "")).length, 16);
  assert.equal(ddq.rows.length - 1, 26);
  assert.deepEqual(fnd.rows.slice(1).map((r) => r[0]), o.findings.map((f) => f.id));
  assert.ok(fnd.rows.slice(1).every((r) => r[5] === "2027-01-15"));
  assert.ok(ddq.rows.slice(1).every((r) => r[10] === "Confirmed" && r[6] !== ""));
  assert.equal(ira.rows.find((r) => r[0] === "IRA-16")![8], "Added after v1, not in the manual assessment");
  assert.match(workbookFileName(a), /^TPRA-Deloitte-2026-11-02\.xlsx$/);
});
