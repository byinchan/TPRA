// Report narrative contract: the sections the AI drafts, its JSON schema, and the validator. Pure.

export const NARRATIVE_SECTIONS = [
  { key: "recommendation", title: "Recommendation", hint: "1-2 sentences explaining the code-written recommendation line" },
  { key: "engagement", title: "Engagement & scope", hint: "the vendor, the service, and what was assessed" },
  { key: "inherentRisk", title: "Inherent risk & tier", hint: "what drives the inherent risk and tier" },
  { key: "dueDiligence", title: "Due diligence results", hint: "what the confirmed questionnaire review showed" },
  { key: "findings", title: "Findings & conditions", hint: "what must happen before or after approval" },
  { key: "residual", title: "Residual risk & next review", hint: "residual risk, whether it is provisional, the next review" },
  { key: "method", title: "Method & limitations", hint: "how the assessment was done and its limits" },
] as const;

export type SectionKey = (typeof NARRATIVE_SECTIONS)[number]["key"];
export const SECTION_KEYS = NARRATIVE_SECTIONS.map((s) => s.key) as SectionKey[];
export const SECTION_MAX = 900;

export type Narrative = Record<SectionKey, string>;

export const NARRATIVE_SCHEMA = {
  type: "object",
  properties: Object.fromEntries(NARRATIVE_SECTIONS.map((s) => [s.key, { type: "string", description: s.hint }])),
  required: [...SECTION_KEYS],
  additionalProperties: false,
} as const;

/** Returns trimmed, length-capped sections, or null if any section is missing or not text. */
export function validateNarrative(raw: unknown): { narrative: Narrative; truncated: number } | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  let truncated = 0;
  const out = {} as Narrative;
  for (const key of SECTION_KEYS) {
    const v = r[key];
    if (typeof v !== "string" || !v.trim()) return null;
    let t = v.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (t.length > SECTION_MAX) {
      truncated++;
      t = `${t.slice(0, SECTION_MAX - 1).trimEnd()}…`;
    }
    out[key] = t;
  }
  return { narrative: out, truncated };
}
