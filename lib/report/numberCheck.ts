// Number check: every figure and rating in the narrative must match the code-computed facts.
// Deliberately strict: an unexplained number or a wrong rating word is flagged for the analyst. Pure.
import type { ReportFacts } from "./facts.ts";
import type { Narrative, SectionKey } from "./schema.ts";

export interface Mismatch {
  section: SectionKey;
  found: string;
  expected: string;
}

const WORDS: Record<string, number> = {
  zero: 0, no: 0, none: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, "twenty-one": 21, "twenty-two": 22, "twenty-three": 23, "twenty-four": 24,
  "twenty-five": 25, "twenty-six": 26,
};

/** Every number the narrative may state. */
function allowedNumbers(f: ReportFacts): Set<number> {
  const d = f.dueDiligence;
  const c = f.findingCounts;
  const tierNumber = Number(f.inherentRisk.tier.replace(/\D/g, ""));
  const pct = (n: number) => Math.round((n / Math.max(d.rowsConfirmed, 1)) * 100);
  const months = f.inherentRisk.cadence.includes("Annual") ? [12, 1] : f.inherentRisk.cadence.includes("2 years") ? [24, 2] : [];
  return new Set([
    d.rowsTotal, d.rowsConfirmed, d.satisfactory, d.gaps, d.needsEvidence, d.aiSuggestionsOverridden, d.notableRows.length,
    pct(d.gaps), pct(d.needsEvidence), pct(d.satisfactory),
    c.total, c.open, c.closed, c.unassignedOpen, c.withoutDueDate,
    f.inherentRisk.highAnswers, f.inherentRisk.mediumAnswers, f.openFollowUps.length, f.answersChangedFromSample.length,
    16, // inherent risk questions
    tierNumber, ...months,
    // Thresholds stated in the rules
    4, 2, 10, 1,
  ]);
}

const LEVEL = "(High|Medium|Low)";

/** Rating words that must agree with the facts when they follow these phrases. */
function ratingChecks(f: ReportFacts): { label: string; pattern: RegExp; expected: string | null }[] {
  return [
    { label: "inherent risk", pattern: new RegExp(`inherent risk (?:is |was |of |rated |level )?(?:assessed as |rated )?${LEVEL}\\b`, "gi"), expected: f.inherentRisk.level },
    { label: "residual risk", pattern: new RegExp(`residual risk (?:is |was |of |rated |remains |stays )?(?:assessed as |rated )?${LEVEL}\\b`, "gi"), expected: f.residualRisk?.level ?? null },
    { label: "control strength", pattern: /control strength (?:is |was |of |rated |assessed as )?(Strong|Adequate|Weak)\b/gi, expected: f.dueDiligence.controlStrength },
    { label: "tier", pattern: /\bTier (\d)\b/g, expected: f.inherentRisk.tier.replace("Tier ", "") },
  ];
}

const DECISIONS = ["Approve with conditions", "Escalate"] as const;

export function checkNarrative(narrative: Narrative, f: ReportFacts): Mismatch[] {
  const allowed = allowedNumbers(f);
  const dates = new Set([f.assessedOn, f.nextReviewDate, ...f.findings.map((x) => x.dueDate)].filter(Boolean) as string[]);
  const out: Mismatch[] = [];

  for (const [section, raw] of Object.entries(narrative) as [SectionKey, string][]) {
    // IDs (IRA-13, DDQ-11, F-DDQ-03-NE), ISO dates and standard names carry digits that are not figures.
    let text = raw;
    for (const m of text.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)) {
      if (!dates.has(m[0])) out.push({ section, found: m[0], expected: `a date from the data (${[...dates].join(", ") || "none"})` });
    }
    text = text
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
      .replace(/\bF-[A-Z]+-\d+(?:-[A-Z]+)?\b|\b(?:IRA|DDQ)-\d+\b/g, " ")
      .replace(/\b(?:ISO\/IEC\s*)?27001(?::\d{4})?\b|\bSOC\s*2\b|\bSP\s*800-161(?:\s*Rev\.?\s*1)?\b|\bNIST\b|\b800-161\b/gi, " ")
      .replace(/\b(?:19|20)\d{2}\b/g, (y) => (dates.size && [...dates].some((d) => d.startsWith(y)) ? " " : y));

    for (const m of text.matchAll(/\b(\d+(?:\.\d+)?)\s*(%|percent)?/g)) {
      const n = Number(m[1]);
      if (!allowed.has(n)) out.push({ section, found: m[0].trim(), expected: "a figure from the computed results" });
    }
    for (const m of text.toLowerCase().matchAll(/\b(twenty-(?:one|two|three|four|five|six)|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/g)) {
      const n = WORDS[m[1]!]!;
      if (!allowed.has(n)) out.push({ section, found: m[1]!, expected: "a figure from the computed results" });
    }
    for (const check of ratingChecks(f)) {
      for (const m of raw.matchAll(check.pattern)) {
        const said = m[1]!;
        if (check.expected === null) out.push({ section, found: m[0], expected: `${check.label} is not available yet` });
        else if (said.toLowerCase() !== check.expected.toLowerCase()) out.push({ section, found: m[0], expected: `${check.label} ${check.expected}` });
      }
    }
    // Counts stated next to what they count must be exact (thresholds like 2 or 4 are allowed elsewhere).
    const NUM = "(\\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)";
    const exact: [RegExp, number, string][] = [
      [new RegExp(`\\b${NUM} (?:confirmed )?gaps?\\b`, "gi"), f.dueDiligence.gaps, "Gap count"],
      [new RegExp(`\\b${NUM} (?:confirmed )?(?:rows? |responses? |items? )?(?:rated |marked )?needs[ -]evidence\\b`, "gi"), f.dueDiligence.needsEvidence, "Needs evidence count"],
      [new RegExp(`\\b${NUM} open findings?\\b`, "gi"), f.findingCounts.open, "open findings"],
      [new RegExp(`\\b${NUM} (?:open )?follow-ups?\\b`, "gi"), f.openFollowUps.length, "open follow-ups"],
      [new RegExp(`\\b${NUM} findings? (?:are|is|remain|remains) open\\b`, "gi"), f.findingCounts.open, "open findings"],
      [new RegExp(`\\b${NUM} unanswered (?:inherent risk )?questions?\\b`, "gi"), f.openFollowUps.length, "open follow-ups"],
      [new RegExp(`\\b${NUM} (?:inherent risk )?questions? (?:remain|remains|are|is)(?: still)? (?:unanswered|unknown|open)\\b`, "gi"), f.openFollowUps.length, "open follow-ups"],
      [new RegExp(`\\b${NUM} (?:outstanding|supporting) documents?\\b`, "gi"), f.dueDiligence.needsEvidence, "Needs evidence count"],
    ];
    for (const [pattern, expected, label] of exact) {
      for (const m of raw.matchAll(pattern)) {
        const t = m[1]!.toLowerCase();
        const n = /^\d+$/.test(t) ? Number(t) : WORDS[t];
        if (n !== expected) out.push({ section, found: m[0], expected: `${label} ${expected}` });
      }
    }
    const decision = f.recommendation?.decision ?? "";
    for (const d of DECISIONS) {
      // Case-sensitive: the decision label, not a generic "escalate".
      if (new RegExp(`\\b${d}\\b`).test(raw) && !decision.startsWith(d)) {
        out.push({ section, found: d, expected: decision ? `recommendation ${decision}` : "no recommendation yet" });
      }
    }
  }
  return out;
}
