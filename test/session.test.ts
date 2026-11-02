import { test } from "node:test";
import assert from "node:assert/strict";
import { REASON_MAX, STATE_VERSION, createFromSample, parseState, setIraAnswer } from "../lib/session.ts";
import { SAMPLES } from "../lib/sample.ts";
import { assessInherent, describeChange } from "../lib/ira.ts";

const sample = SAMPLES["v1-deloitte"]!;
const fresh = () => createFromSample(sample, "2026-11-02");
const AT = "2026-11-02T18:00:00.000Z";

test("loading the sample fills all 16 IRA answers and 26 questionnaire responses", () => {
  const s = fresh();
  assert.equal(s.version, STATE_VERSION);
  assert.equal(s.ira.length, 16);
  assert.equal(s.ddq.length, 26);
  assert.equal(s.ira.find((r) => r.id === "IRA-13")?.answer, "Unknown");
  assert.ok(s.ira.every((r) => r.answer === r.loadedAnswer && r.history.length === 0));
});

test("a valid state round-trips through JSON", () => {
  const s = setIraAnswer(fresh(), "IRA-12", "No", "Questionnaire DDQ-23", AT);
  assert.deepEqual(parseState(JSON.stringify(s)), s);
});

test("anything that fails validation is discarded", () => {
  const good = fresh();
  const variants: unknown[] = [
    null,
    "not json",
    { ...good, version: 1 },
    { ...good, version: 3 },
    { ...good, sampleId: "someone-else" },
    { ...good, assessedOn: "2026-13-01" },
    { ...good, ira: good.ira.slice(1) },
    { ...good, ira: good.ira.map((r, i) => (i === 0 ? { ...r, id: "IRA-99" } : r)) },
    { ...good, ira: good.ira.map((r, i) => (i === 0 ? { ...r, answer: "Maybe" } : r)) },
    { ...good, ira: good.ira.map((r, i) => (i === 0 ? { ...r, history: [{ from: "Yes", to: "No", at: AT, reason: "" }] } : r)) },
    { ...good, ddq: good.ddq.map((r, i) => (i === 0 ? { ...r, response: "x".repeat(2001) } : r)) },
    [good],
  ];
  for (const v of variants) {
    const raw = v === null ? null : typeof v === "string" ? v : JSON.stringify(v);
    assert.equal(parseState(raw), null, raw?.slice(0, 80));
  }
});

test("unknown extra fields are dropped on load", () => {
  const raw = JSON.stringify({ ...fresh(), injected: "<script>", ira: fresh().ira.map((r) => ({ ...r, extra: 1 })) });
  const parsed = parseState(raw)!;
  assert.equal("injected" in parsed, false);
  assert.equal("extra" in parsed.ira[0]!, false);
});

test("changing an answer needs a reason and is recorded in history", () => {
  assert.throws(() => setIraAnswer(fresh(), "IRA-13", "Yes", "   ", AT), /reason is required/);
  assert.throws(() => setIraAnswer(fresh(), "IRA-13", "Yes", "x".repeat(REASON_MAX + 1), AT));
  const s = setIraAnswer(fresh(), "IRA-13", "Yes", " DDQ-11: residency not guaranteed ", AT);
  const row = s.ira.find((r) => r.id === "IRA-13")!;
  assert.equal(row.answer, "Yes");
  assert.equal(row.loadedAnswer, "Unknown");
  assert.deepEqual(row.history, [{ from: "Unknown", to: "Yes", at: AT, reason: "DDQ-11: residency not guaranteed" }]);
});

test("resolving IRA-13 to Yes: High / Tier 1, and the notice names the edit and the rule", () => {
  const before = fresh();
  const after = setIraAnswer(before, "IRA-13", "Yes", "DDQ-11", AT);
  const a0 = assessInherent(before.ira);
  const a1 = assessInherent(after.ira);
  assert.equal(a1.inherent.level, "High");
  assert.equal(a1.tier.label, "Tier 1");
  const notes = describeChange(a0, a1, { id: "IRA-13", from: "Unknown", to: "Yes" });
  assert.deepEqual(notes, [
    "Inherent risk changed from Medium to High and the tier from Tier 2 to Tier 1 after IRA-13 changed from Unknown to Yes. Rule: High because 4 answers are rated High (threshold 4).",
  ]);
});

test("no notice when the level does not change; FIPPA changes are reported", () => {
  const s0 = fresh();
  const s1 = setIraAnswer(s0, "IRA-12", "No", "DDQ-23", AT);
  assert.deepEqual(describeChange(assessInherent(s0.ira), assessInherent(s1.ira), { id: "IRA-12", from: "Unknown", to: "No" }), []);
  const s2 = setIraAnswer(s0, "IRA-16", "Yes", "Interviews include staff", AT);
  const notes = describeChange(assessInherent(s0.ira), assessInherent(s2.ira), { id: "IRA-16", from: "No", to: "Yes" });
  // IRA-16 = Yes is also a 4th High, so both the inherent risk and the FIPPA flag change.
  assert.equal(notes.length, 2);
  assert.match(notes[0]!, /^Inherent risk changed from Medium to High .* after IRA-16 changed from No to Yes\./);
  assert.match(notes[1]!, /^FIPPA flag triggered after IRA-16 changed from No to Yes\. Rule: Triggered:/);
});
