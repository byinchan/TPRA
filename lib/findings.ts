// Which open items become findings. Owner, due date and status are added on screen 3.
import { FIPPA } from "../config/rules.ts";
import type { FippaResult } from "./ira.ts";
import type { DdqRating } from "./types.ts";

export type FindingSource = "IRA follow-up" | "Due diligence" | "FIPPA";

export interface FindingSeed {
  /** Stable: derived from the source row, so it survives re-scoring. */
  id: string;
  source: FindingSource;
  sourceRow: string;
  title: string;
}

export interface FindingInputs {
  /** IRA IDs still answered "Unknown". */
  followUps: readonly { id: string; question: string }[];
  /** CONFIRMED questionnaire rows only. */
  confirmedDdq: readonly { id: string; question: string; rating: DdqRating }[];
  fippa: FippaResult;
}

export function collectFindings({ followUps, confirmedDdq, fippa }: FindingInputs): FindingSeed[] {
  return [
    ...followUps.map((f) => ({
      id: `F-${f.id}`,
      source: "IRA follow-up" as const,
      sourceRow: f.id,
      title: `Resolve unknown answer: ${f.question}`,
    })),
    ...confirmedDdq
      .filter((r) => r.rating !== "Satisfactory")
      .map((r) => ({
        id: `F-${r.id}`,
        source: "Due diligence" as const,
        sourceRow: r.id,
        title: `${r.rating}: ${r.question}`,
      })),
    ...(fippa.triggered
      ? [{ id: "F-FIPPA", source: "FIPPA" as const, sourceRow: FIPPA.leavesCanadaId, title: FIPPA.findingTitle }]
      : []),
  ];
}
