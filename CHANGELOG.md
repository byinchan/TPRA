# Changelog

Decisions, defaults and back-test differences. Bernadette makes the final call on rules and content.

## PR 1: setup, v1 baseline, sample extraction (2026-11-02)

### Added
- `.gitignore`: `node_modules/`, `.next/`, `.env.local`, `.env*.local`, `reference-sources/`, `.DS_Store`, `.vercel/`.
- `CLAUDE.md` (project instructions) at the repo root.
- `/v1`: the three original manual v1 files, byte-for-byte copies. These are never edited.
- `data/v1-vendor.json`: 15 IRA rows (IRA-01..IRA-15) and 26 questionnaire rows (DDQ-01..DDQ-26), copied verbatim from /v1. Also includes the v1 overall inherent rating (Medium) and the 5 supporting documents the questionnaire lists.
- `test/v1-vendor.test.mjs`: checks the counts, stable IDs and allowed values, then re-reads /v1 and confirms every question, answer, rating and response matches exactly. No dependencies; run it with `node --test`.

### Decisions (defaults, open to change)
- **Domain names** are stored without their v1 numbering ("1. Information Security Governance" becomes "Information Security Governance"). Row order keeps the sequence.
- **Source quirks are kept verbatim**:
  - DDQ-21 has "Yes . Risk-based…" (space before the full stop).
  - DDQ-11 uses an en dash ("No – Data residency…").
- **v1 summary .docx** stays in /v1 only. Its "Project 4" sentence and the "SIG QuestionnaireF" typo are not carried into the app, so the app never links to another project.
- **Test file** is `.mjs` so it runs before the Next.js/TypeScript scaffold exists (PR 2).

### Back-test of the draft rules (for review; no rule code yet)
- **Inherent risk: Medium (mean 1.67), which agrees with v1.** Neither High clause fires:
  - No PII and no regulated info, so the Data clause does not apply.
  - There are 3 Highs across 3 areas, but the mean is below 2.2.
- **Tier 2** (SIG Lite, review every 2 years). This is new; v1 had no tier.
- **Open follow-ups:** IRA-12 (subcontractors) and IRA-13 (data leaving the country).
- **FIPPA:** checked, not triggered (customer PII = No).
- **Expected residual risk:** Adequate controls (1 Gap at DDQ-11, Needs evidence at DDQ-03, 18 and 23) give **Medium (Provisional)** and **Approve with conditions**. This matches v1's "may proceed once these actions are completed".
- **Open questions for Bernadette:**
  - Should the mean ≥ 2.2 High clause stay as it is? It almost never fires.
  - The per-question answer→rating table, especially inverse questions such as IRA-09.
  - FIPPA scope: employee personal information is not asked about.

## PR 2: confirmed rule decisions, scaffold, rules engine (2026-11-02)

### Decisions confirmed by Bernadette (recorded in CLAUDE.md)
1. **Inherent risk uses counts only, no average.**
   - High: IRA-02 (customer PII) = Yes, or IRA-03 (regulated info) = Yes, or 4+ answers rated High.
   - Low: no Highs and 2 or fewer Mediums.
   - Medium: otherwise.
2. **Answer-to-rating table.** "Unknown" is Medium for every question and opens a follow-up.
   - Yes = High, No = Low: IRA-01, 02, 03, 05, 06, 07, 08, 10, 13, 15, 16.
   - Yes = Medium, No = Low: IRA-04, 11, 12, 14.
   - Yes = Low, No = Medium: IRA-09.
   - **Verified: this reproduces all 15 v1 per-question ratings.**
3. **IRA-16 added:** "Will employee or other personal information be shared?"
   - Marked "added after v1, not in the manual assessment". Deloitte answer: No.
   - FIPPA now triggers if IRA-13 = Yes/Unknown AND (IRA-02 or IRA-16 = Yes/Unknown).
   - The verbatim v1 test still covers the original 15 rows only.
4. **Excel library:** write-excel-file. It is added in the Excel export PR, where it is first used.

### Back-test re-run with the confirmed rules (`npm run backtest`)
- **All 15 v1 per-question ratings match.** IRA-16 rates Low (No).
- **Inherent risk: Medium, which agrees with v1.** There are 3 Highs (IRA-01, 07, 15), below the threshold of 4, and IRA-02 and IRA-03 are both No.
- **Tier 2** (SIG Lite, review every 2 years).
- **Follow-ups:** IRA-12 and IRA-13.
- **FIPPA:** checked, not triggered. IRA-13 = Unknown, but IRA-02 and IRA-16 are both No.
- **Expected due diligence reading:**
  - DDQ-11 Gap; DDQ-03, DDQ-18 and DDQ-23 Needs evidence.
  - Control strength Adequate, residual Medium (Provisional), Approve with conditions.
  - Next review 2028-11-02.
- **Changes since PR 1:** none in the outcome.
- **Sensitivity, now much sharper (for Bernadette to note):** IRA-13 is one High away from flipping the result.
  - Resolving the IRA-13 follow-up to **Yes** (e.g. from DDQ-11 "residency not guaranteed") makes a 4th High.
  - That moves **inherent to High and Tier 1**.
  - Resolving it to No, or IRA-12 to No, keeps Medium.

### Other decisions (defaults, open to change)
- **Next.js upgraded from the pinned 16.3.6 to 16.4.4 for security fixes.** `npm audit` on 16.3.6 reported:
  - 2 critical: GHSA-2464-fhr4-w9xw and GHSA-673q-mjm6-r5xr, remote code execution, fixed in 16.4.1.
  - 2 high: GHSA-cjq9-62q9-8jv4 and GHSA-p3m5-59mp-jv5r.
  - 3 medium.
  - 16.4.4 is the latest patch and audits clean.
  - React 19.3.0, Tailwind 4.3.3 and TypeScript 5.9.3 are as pinned.
- **Dependencies (all justified):**
  - Runtime: next, react, react-dom.
  - Dev: typescript, tailwindcss and @tailwindcss/postcss (the CLAUDE.md stack), plus @types/react, @types/react-dom and @types/node (type checking only).
  - No ESLint: Next 16 removed `next lint`, so CI runs `tsc --noEmit` instead.
- **Tests are TypeScript run directly by Node 24** (type stripping), so there is no test framework or build step.
  - lib/ imports use `.ts` extensions.
  - `erasableSyntaxOnly` keeps the code runnable by Node.
  - `engines.node` is `24.x` so Vercel uses the same Node version.
- **Tests before deploy:** `prebuild` runs `npm test`, so a failing test fails the Vercel build. GitHub Actions CI runs typecheck, tests and build on every PR.
- **Control strength with zero confirmed rows** is "Not assessed" (null), not Strong.
- **Next review date** follows the tier set by *inherent* risk (12 / 24 months, or at renewal for Tier 3).
  - It is computed from the assessment date.
  - Months are clamped to the last day of the month, e.g. Jan 31 + 1 month = Feb 28.
- **Recommendation order:** Escalate is checked first, so control strength Weak escalates even when residual risk is Medium.
- **`/rules` page:** shows every rule with a Confirmed/Draft badge, the answer table and the live v1 back-test. It will move into the About page later.

### Still DRAFT (unchanged from CLAUDE.md; need Bernadette's sign-off)
- Tier and review cadence
- Control strength (10% Needs evidence; max 1 Gap)
- Residual risk shift
- Recommendation

### Update: all rules confirmed (2026-11-02)
- **Bernadette confirmed the four remaining rules as written:** tier and review cadence, control strength, residual risk shift, and recommendation. `config/rules.ts` now marks every rule as Confirmed.
- **IRA-13 stays Yes = High.**
  - The sample loads it as Unknown (Medium, matching v1).
  - If an analyst resolves it to Yes, the move to High / Tier 1 is intended.
  - Screen 1 shows the rule that caused the change.
- **New: a triggered FIPPA flag opens a finding,** "Confirm with Privacy Office whether a supplementary assessment is required".
  - The finding comes from `lib/findings.ts` (`collectFindings`).
  - The recommendation cannot be "Approve" while it is open.
  - Tested: FIPPA triggered, all 26 rows Satisfactory, Strong controls, Low residual → "Approve with conditions".

## PR 3: screen 1, intake and inherent risk (2026-11-02)

### Added
- **Screen 1 at `/`:**
  - "Load sample vendor" fills all 16 IRA answers and all 26 questionnaire responses in one click.
  - Answers are grouped by area. Each row shows the rating table and the v1 rating. IRA-16 is labelled "Added after v1, not in the manual assessment".
- **The Code panel recalculates live:**
  - Inherent risk with the rule clause that decided it, plus High/Medium/Low counts.
  - Tier, due diligence depth and reassessment cadence.
  - Open follow-ups: every Unknown answer.
  - FIPPA status: "checked, not triggered" with the reason, or the triggered message plus "Opens a finding…" and the not-legal-advice note.
- **Change notice:** when an edit changes the inherent risk/tier or the FIPPA flag, a notice states what changed, which edit caused it and the rule that now applies (`describeChange` in lib/ira.ts). Example: "Inherent risk changed from Medium to High and the tier from Tier 2 to Tier 1 after IRA-13 changed from Unknown to Yes. Rule: High because 4 answers are rated High (threshold 4)."
- **Traceability:**
  - Changing an answer requires a reason (max 300 characters).
  - Each change is kept in the row's history (from, to, time, reason) along with the answer as loaded.
  - Edited rows carry a "Human-edited" badge.
- **Session state (`lib/session.ts`):**
  - sessionStorage key `tpra.assessment.v1` with a schema version.
  - Every field is checked on load: IDs in order, answer values, history entries, text length caps.
  - Unknown fields are dropped. Anything invalid is discarded and the screen says so.
  - The UI says the data lives in this tab only.
- **`lib/sample.ts`:** the sample registry, with the vendor disclaimer verbatim. Sample 2 will plug in here.
- **Tests:** 33 passing.
  - Session round-trip.
  - 11 invalid-state cases.
  - Extra fields dropped.
  - Reason required.
  - IRA-13 → Yes notice text.
  - Combined inherent risk + FIPPA notice for IRA-16 → Yes.

### Decisions (defaults, open to change)
- **IRA-16 = Yes** is also a 4th High for Deloitte, so it moves inherent risk to High as well as triggering FIPPA. Both notices are shown.
- **The assessment date** is the analyst's local date when the sample is loaded.
- **"Start over"** asks for confirmation, then clears the tab's state.
- **Screens 2 and 3** show as greyed-out steps until their PRs land.
- **On narrow screens** a compact sticky summary (inherent risk · tier · follow-ups) stays at the top and links to the full Calculated panel below the questions. On wide screens the panel stays in view beside them.
