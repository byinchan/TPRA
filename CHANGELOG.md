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

## PR 4: AI review route and demo mode (2026-11-02)

### Added
- **`POST /api/review` (server-only):** the AI proposes, per questionnaire row:
  - a rating (Satisfactory / Gap / Needs evidence);
  - a one-line rationale;
  - any conflict with IRA answers;
  - the evidence to request.

  It also lists IRA inconsistencies. It never rates inherent risk, scores anything or recommends a decision.
- **Model:** `claude-haiku-5-5`, set in `config/ai.ts` and overridable with the `ANTHROPIC_MODEL` env var.
  - Effort is set explicitly to `medium`, which is Haiku 5.5's default.
  - Pricing is $0.10 / $0.50 per million input / output tokens (Claude API docs, checked 2026-11-02).
  - A review is roughly a few thousand tokens each way, so well under a cent per call.
- **SDK:** `@anthropic-ai/sdk` 1.3.0 (Apache-2.0).
  - The Claude API guidance for TypeScript projects is to use the official SDK rather than raw fetch.
  - It provides typed errors (429 `RateLimitError`, 402 `billing_error`, 5xx, connection) and request IDs.
- **Structured outputs:** `output_config.format` with a JSON schema, instead of forced tool use.
  - This is the documented way to get schema-valid JSON.
  - Forced `tool_choice` is rejected by several current models.
  - No Zod: the schema is plain JSON, and our own validator checks every response anyway.
- **The model is treated as an untrusted component (`lib/ai/schema.ts` `validateReview`).** Live and saved outputs pass the same checks:
  - Unknown DDQ/IRA IDs are dropped and counted.
  - Duplicate or malformed rows are dropped and counted.
  - Missing rows are listed, not filled.
  - Text is whitespace-normalised and length-capped, with truncations counted.
  - The results are returned as `guardrails`, so the UI can show them.
- **Prompt-injection posture (`lib/ai/prompt.ts`):**
  - The browser sends only the 16 IRA answers (an enum). The request parser rejects any other field.
  - Question text and vendor responses come from the server's sample data.
  - All of it is passed as data inside tags, with `<` escaped so data cannot close a tag. The system prompt says the data is not instructions.
- **Demo mode** switches on automatically when:
  - there is no key;
  - the per-IP limit or the daily cap is hit;
  - Anthropic returns 429 or 402 (`billing_error`, credit exhausted);
  - Anthropic is unavailable (5xx/529/connection after one SDK retry).

  The analyst can also request it. Demo output says when the analyst's IRA answers differ from the ones it was made for.
- **Other failures** (refusal, `max_tokens`, invalid JSON or schema, other 4xx) return a generic error with a "use the saved demo" option. Model output is never shown unvalidated.
- **Limits (`lib/ai/limits.ts`):** 5 live calls per IP per hour, 100 live calls per UTC day, and an 8 KB request body cap.
- **Logging:** one JSON line per call with the outcome and the Anthropic request ID. No request or response text.
- **`scripts/record-demo.ts` (`npm run record-demo`):** records a real model run over the sample and validates it before saving it as the demo output.
- **Tests:** 48 passing (15 new).
  - Validator: dropped IDs, duplicates, missing rows, truncation, inconsistencies.
  - Schema: uses only supported features.
  - Request parser: rejects extra fields and vendor text.
  - Prompt: escaping.
  - Live vs demo: every demo reason.
  - Error paths: refusal, `max_tokens`, invalid JSON.
  - Limiter: window and day reset.
  - Logs: carry no text.

### Decisions (defaults, open to change)
- **The demo output is a placeholder written by the developer (`source.kind: "mock"`) until the key is set.**
  - It is not model output, and the response says so.
  - It matches the back-test reading: DDQ-11 Gap; DDQ-03, 18 and 23 Needs evidence; conflicts on IRA-13 and IRA-12; inconsistencies IRA-07/08 and IRA-03/14.
  - It will be replaced by a recorded model run (`npm run record-demo`) and reviewed before commit.
- **Rate limit and daily cap are in-memory, per server instance.** On Vercel, separate instances do not share counts, and counts reset when an instance restarts. The real budget cap is the prepaid Anthropic credit with auto-reload off. The README will say so.
- **Anthropic 429, 402 and outages fall back to demo**, so a visitor always sees a working flow, clearly labelled. Other errors are shown as errors, so the guardrail is visible.
- **Questionnaire responses are not editable in v1.** A blank "new vendor" intake is in the v2 backlog, so the only analyst input to the model is the IRA answer enum.

## PR 5: screen 2, due diligence review (2026-11-02)

### Added
- **Screen 2 at `/review`:**
  - "Get AI suggestions" calls `/api/review`. "Use saved demo review" is the alternative.
  - Each of the 26 rows shows three separate columns: **Vendor response | AI suggestion (AI badge) | Analyst decision (Analyst badge)**.
  - The AI column shows the rating, rationale, any conflict (IRA IDs, their questions and a note) and the evidence to request.
- **The analyst edits and confirms each row:**
  - Changing the AI's rating requires an override reason before Confirm is enabled.
  - Editing a confirmed row reopens it.
  - Badges: AI-suggested / Human-edited / Analyst-entered, plus Confirmed / Awaiting review.
  - Only confirmed rows count.
- **History per row:** AI suggestion (live/demo + reason) → edits → confirmation (with any override reason) → reopen. The AI's original suggestion is never overwritten.
- **Review banner:**
  - "AI-generated, human-reviewed", Live or Demo mode, and the plain-language demo reason.
  - A placeholder notice while the demo output is the developer-written mock.
  - A warning when the analyst's IRA answers differ from those the saved demo was made for.
  - A **validation line** (removed IDs, removed rows, missing rows, shortened text, or "all 26 suggestions passed").
- **IRA inconsistencies panel (AI, advisory):** each flagged pair with its questions and current answers, plus a link to screen 1. Nothing changes automatically.
- **Open follow-ups panel:**
  - The analyst resolves an Unknown IRA answer to Yes or No from a chosen questionnaire row, with a required note.
  - The source row defaults to the row the AI flagged.
  - The answer is updated through the same audited path as screen 1 ("Resolved from DDQ-11: …") and re-scores.
  - The change notice names the rule.
- **Code panel:** inherent risk and tier, confirmed count, awaiting count, Gap / Needs evidence among confirmed rows, and control strength with its rule (marked "Partial" until all rows are confirmed).
- **Narrow screens:** a sticky summary bar.
- **Tier 1 notice:** Tier 1 calls for the full SIG plus evidence, but this prototype only has the 26-question SIG Lite–based questionnaire. The screen says so whenever the tier is 1.
- **Navigation:** step pills link between screens once an assessment is loaded. Screen 1 has a "Continue to due diligence review" button.
- **`lib/ddq.ts`** (pure, tested): `applyAiReview`, `editDecision`, `confirmRow`, `reopenRow`, `discardAiReview`, `resolveFollowUp`, `confirmedRatings`, `rowBadges`.
- **`lib/ai/types.ts`:** result types with no runtime dependencies, so the browser bundle never includes the prompt, demo data or SDK (checked: the client bundle has no prompt text, key name or API URL).
- **Tests:** 56 passing (8 new). Confirming all 26 demo suggestions unchanged reproduces the back-test: Adequate, 1 Gap, 3 Needs evidence.

### Decisions (defaults, open to change)
- **Session state is now version 2** (`tpra.assessment.v2`), holding the AI suggestion, decision, override reason and history per row.
  - A tab still holding version 1 data fails validation and starts fresh, with the "discarded" notice.
  - AI data read back from storage is re-checked strictly; any unknown ID rejects the whole state.
- **One AI review per assessment.** "Discard and start again" clears suggestions and decisions but keeps IRA answers. This avoids silently mixing two AI runs.
- **No "confirm all" button:** each row is confirmed on its own, which is the point of the human review.
- **Text edits are saved when the field loses focus**, so history records edits rather than keystrokes.
- **Inconsistency flags are advisory:** they never change an answer on their own.

## PR 6: screen 3a, findings, residual risk, recommendation (2026-11-02)

### Added
- **Screen 3 at `/report`, Calculated outcome (Code):**
  - Recommendation with its reason.
  - Inherent risk + tier + rule.
  - Control strength + rule (with confirmed count).
  - Residual risk + rule + "Provisional" flag.
  - Next review date with cadence.
  - FIPPA status (not legal advice).
- **Findings (Code lists them; the Analyst sets owner, due date, status):**
  - **Sources:** every open IRA follow-up, every confirmed Gap / Needs evidence row, and a triggered FIPPA flag.
  - **Defaults:** owner "Vendor owner (to assign)" and no due date, flagged as "No due date set".
  - **Closing:** requires a note. Reopen is allowed, and history records owner, due date, close and reopen.
  - **Links:** each finding links to its source row.
- **`lib/outcome.ts` `computeOutcome(state)`:** the single pure function behind screen 3. The report, PDF and Excel export will use it too. It includes the code-written recommendation line for the report.
- **`lib/findings.ts`:** each finding has an explicit `kind` (Follow-up / Gap / Needs evidence / FIPPA), plus `withDetails`, `setOwner`, `setDueDate`, `closeFinding` and `reopenFinding`.
- **Session state is now version 3** (`tpra.assessment.v3`) with analyst finding details.
  - Each detail is validated on load: ID pattern, owner length, real dates, and a closed status needs a note.
  - Duplicate IDs are rejected.
- **Navigation:** screen 2 has "Continue to findings & report", and the step pill for screen 3 is now a link.
- **Tests:** 64 passing. 8 are new end-to-end outcome tests through the real workflow functions:
  - Blocked until all rows are confirmed.
  - The v1 back-test: Medium / Adequate / Medium (provisional) / Approve with conditions / 6 findings / 2028-11-02.
  - IRA-13 → Yes gives Escalate.
  - Closing everything gives Approve.
  - Follow-ups can't be closed by hand.
  - FIPPA blocks Approve.
  - Owner and due date are recorded and survive storage.
  - Re-rating a row removes its finding.

### Decisions (defaults, open to change)
- **Residual risk and the recommendation appear only once all 26 rows are confirmed.** Until then, the screen lists what is blocking them. A recommendation built on partly reviewed data would contradict "only confirmed rows count".
- **IRA follow-up findings close only by resolving the IRA answer** (screen 2, with a note), never by hand. This keeps the finding and the inherent risk answer consistent.
- **"Provisional" lasts while any Needs-evidence finding is open.** Closing one (e.g. "certificate received") clears it. The row's rating stays as confirmed, so control strength does not change.
- **Due dates are optional for now.** The report-approval PR can require them; that is Bernadette's call.
- **Consequence of the confirmed rules, for Bernadette to note:** resolving IRA-13 to Yes from DDQ-11 makes Deloitte High inherent with Adequate controls. That gives High residual risk, so the recommendation is **Escalate - do not approve yet**. A test now locks this in.

### Update: Bernadette's PR 6 decisions (2026-11-02)
1. **Escalate is kept** (IRA-13 → Yes leads to Escalate). Screen 3 adds one line, kept in `config/rules.ts` `RECOMMENDATION_MEANING` so the report can reuse it: a designated risk owner must decide whether to accept the residual risk; it does not mean the vendor is rejected.
2. **The recommendation waits for all 26 confirmed rows** (confirmed).
3. **Report approval requires a due date on every open finding.** Owners may stay "Vendor owner (to assign)", but the report lists them as unassigned. This is recorded in CLAUDE.md and enforced in PR 7.
4. **Closing a Needs evidence finding re-rates its source row** (Satisfactory or Gap) with the evidence note as the reason, then re-confirms the row. Control strength recalculates.
   - `closeNeedsEvidence` in `lib/findings.ts`.
   - Tested both ways: re-rating DDQ-03 Satisfactory gives 1 Gap / 2 NE; re-rating DDQ-18 Gap gives 2 Gaps, which is Weak, so Escalate.

### Changes needed to support decision 4
- **Finding IDs now include the kind** (`F-DDQ-03-NE`, `F-DDQ-11-GAP`). A Needs evidence row re-rated Gap closes its NE finding and opens a separate Gap finding.
- **Closed findings stay listed** after their source changes. This covers a re-rated row (kept from a snapshot taken at closing) and a follow-up resolved on screens 1–2 (from the IRA answer history). They are marked "kept for traceability" and cannot be reopened from screen 3.
- **Who can reopen what:**
  - Gap and FIPPA findings can be reopened.
  - A Needs evidence finding reopens automatically if its row is re-rated Needs evidence on screen 2.
- **`confirmRow` records a reason whenever one is given**, not only when the rating differs from the AI's.
- **Tests:** 65 passing.
