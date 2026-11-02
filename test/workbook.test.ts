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
  const n = validateNarrative(DEMO_NARRATIVES["v1-halden"]!.output)!.narrative;
  s = applyNarrative(s, { ok: true, mode: "demo", demoReason: "requested", demoMatchesFacts: true, source: DEMO_NARRATIVES["v1-halden"]!.source, narrative: n, truncated: 0 }, AT);
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

test("workbook has five sheets and every figure matches the computed outcome", async () => {
  const { s } = await approved();
  const a = approveReport(s, AT);
  const o = computeOutcome(a);
  const t = buildWorkbookTables(a)!;
  assert.deepEqual(t.map((x) => x.name), ["Summary", "Inherent Risk", "Due Diligence", "Findings", "Audit trail"]);
  const [sum, ira, ddq, fnd, audit] = t as [typeof t[0], typeof t[0], typeof t[0], typeof t[0], typeof t[0]];
  const field = (k: string) => sum.rows.find((r) => r[0] === k)?.[1];
  assert.equal(sum.rows[0]![0], "Third-Party Risk Assessment – Halden Advisory (fictional)");
  assert.equal(field("Recommendation"), o.recommendation!.decision);
  assert.equal(field("Inherent risk"), `${o.inherent.level} (${o.tier.label})`);
  assert.equal(field("Control strength"), o.strength.strength);
  assert.equal(field("Next review date"), o.nextReview);
  assert.equal(field("Open findings"), String(o.openFindings));
  assert.deepEqual(ira.rows[0], ["Area", "Question", "Answer", "Rating"]);
  assert.equal(ira.rows.length - 1, 16);
  assert.equal(ddq.rows[0]!.length, 6);
  assert.equal(ddq.rows.length - 1, 26);
  assert.ok(ddq.rows.slice(1).every((r) => r[3] !== ""));
  assert.deepEqual(fnd.rows[0], ["ID", "Type", "Title", "Owner", "Due date", "Status"]);
  assert.deepEqual(fnd.rows.slice(1).map((r) => r[0]), o.findings.map((f) => f.id));
  assert.ok(fnd.rows.slice(1).every((r) => r[4] === "2027-01-15"));
  assert.equal(audit.rows.filter((r) => r[0] === "Due diligence row").length, 26);
  assert.ok(audit.rows.some((r) => r[0] === "Rule applied" && r[1] === "Inherent risk" && r[6] === o.inherent.reason));
  assert.ok(t.every((x) => x.widths.every((w) => w <= 45) && x.rows.every((r) => r.length <= x.widths.length)));
  assert.match(workbookFileName(a), /^TPRA-Halden-Advisory-fictional-2026-11-02\.xlsx$/);
});
