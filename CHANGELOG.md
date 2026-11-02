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
