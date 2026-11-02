// Prints the back-test of the rules against the v1 Deloitte sample: `npm run backtest`.
// The expected DDQ ratings below are Claude's reading for the back-test only, not AI output and
// not Bernadette's decisions. In the app, the AI proposes and the analyst confirms each row.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assessInherent } from "../lib/ira.ts";
import { controlStrength, recommendation, residualRisk } from "../lib/residual.ts";
import { nextReviewDate } from "../lib/dates.ts";
import type { Answer, DdqRating, Level } from "../lib/types.ts";

export interface V1Vendor {
  vendor: string;
  service: string;
  v1Labels: { overallInherentRisk: Level };
  ira: { id: string; area: string; question: string; answer: Answer; v1Rating: Level | null; addedAfterV1: boolean }[];
  ddq: { id: string; domain: string; question: string; response: string }[];
}

export function loadV1(): V1Vendor {
  return JSON.parse(readFileSync(new URL("../data/v1-vendor.json", import.meta.url), "utf8")) as V1Vendor;
}

const EXPECTED_NON_SATISFACTORY: Record<string, DdqRating> = {
  "DDQ-03": "Needs evidence", // ISO certificate available on request, not yet received
  "DDQ-11": "Gap", // data residency not guaranteed
  "DDQ-18": "Needs evidence", // SOC 2 executive summary under NDA, not yet received
  "DDQ-23": "Needs evidence", // subcontractors only "expected" not to be used
};

export function expectedDdqRatings(v1: V1Vendor): Record<string, DdqRating> {
  return Object.fromEntries(v1.ddq.map((r) => [r.id, EXPECTED_NON_SATISFACTORY[r.id] ?? "Satisfactory"]));
}

function main() {
  const v1 = loadV1();
  const answers = v1.ira.map(({ id, answer }) => ({ id, answer }));
  const a = assessInherent(answers);
  console.log(`Back-test: ${v1.vendor} (${v1.service})\n`);
  console.log("ID      Answer   Rule     v1       Match");
  for (const r of a.rated) {
    const row = v1.ira.find((x) => x.id === r.id)!;
    const v1r = row.v1Rating ?? "(n/a)";
    const match = row.addedAfterV1 ? "added after v1" : v1r === r.rating ? "yes" : "NO";
    console.log(`${r.id}  ${r.answer.padEnd(8)} ${r.rating.padEnd(8)} ${v1r.padEnd(8)} ${match}`);
  }
  console.log(`\nInherent risk: ${a.inherent.level} (v1: ${v1.v1Labels.overallInherentRisk}). ${a.inherent.reason}`);
  console.log(`Tier: ${a.tier.label}, ${a.tier.depth}, ${a.tier.cadence}`);
  console.log(`Follow-ups: ${a.followUps.join(", ") || "none"}`);
  console.log(`FIPPA: ${a.fippa.reason}`);

  const ratings = Object.values(expectedDdqRatings(v1));
  const s = controlStrength(ratings);
  console.log(`\nExpected DDQ reading: ${Object.entries(EXPECTED_NON_SATISFACTORY).map(([k, v]) => `${k} ${v}`).join(", ")}; rest Satisfactory`);
  console.log(`Control strength: ${s.reason}`);
  if (s.strength) {
    const r = residualRisk(a.inherent.level, s.strength, s.needsEvidence);
    const open = s.gaps + s.needsEvidence + a.followUps.length;
    console.log(`Residual risk: ${r.level}${r.provisional ? " (Provisional)" : ""}. ${r.reason}`);
    console.log(`Recommendation: ${recommendation(r.level, s.strength, open).decision} (${open} open findings)`);
    console.log(`Next review (from 2026-11-02): ${nextReviewDate("2026-11-02", a.inherent.level) ?? "at renewal"}`);
  }

  const resolved = answers.map((x) => (x.id === "IRA-13" ? { ...x, answer: "Yes" as const } : x));
  console.log(`\nSensitivity: IRA-13 resolved to Yes -> inherent ${assessInherent(resolved).inherent.level}`);
  const noSub = answers.map((x) => (x.id === "IRA-12" ? { ...x, answer: "No" as const } : x));
  console.log(`Sensitivity: IRA-12 resolved to No  -> inherent ${assessInherent(noSub).inherent.level}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
