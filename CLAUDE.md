# AI-Assisted Third-Party Risk Assessment (TPRA)

## Decisions (final)
- STANDALONE: this repo (github.com/byinchan/TPRA) is its own project with its own Vercel project.
  It must NOT import code from, link to, share keys with, or depend on any other project. Do not
  read or copy from other repos.
- AI PROVIDER: Anthropic Claude API only. Built with Claude Code, powered by Claude.
  Env var: ANTHROPIC_API_KEY (server-side only, never NEXT_PUBLIC_).
- STORAGE: no accounts, no database, no saved sessions. Current browser tab only.
- SCOPE: this is v1 (MVP). Two sample vendors, three screens. Anything in "Not in v1" waits for v2.
  Build everything with Sample 1 first; Sample 2 is the LAST PR and must need no new code paths.

## What this is
A public demo in a GRC portfolio for Pacific Utilities Corporation (PUC), a FICTIONAL BC Crown
corporation (~6,500 employees, critical utility infrastructure, enterprise IT and OT).
Author: Bernadette Chan, GRC Analyst. Hiring managers will use it, so it must be reliable, cheap to
run and safe on the open internet. Deployed on Vercel from GitHub: https://tpra.vercel.app/
Methods: NIST SP 800-161 Rev. 1 (C-SCRM) informs the inherent risk assessment; Shared Assessments
SIG Lite informs the vendor due diligence questionnaire.
Baseline: my manual v1 assessment in /v1 (3 files: Inherent Risk Assessment .xlsx, Vendor Security
Due Diligence Questionnaire .docx, Third-Party Risk Assessment Summary .docx).

## Sample vendor (from /v1)
- Vendor: Deloitte. Service: AI Governance Consulting.
- Extract the 15 IRA questions (5 areas: Data, System Access, Service Criticality, Technology,
  Regulatory) with their answers and my per-question ratings, and the 26 questionnaire questions
  (8 domains) with the vendor responses, into data/v1-vendor.json. Copy wording exactly from /v1;
  do not invent or "improve" answers. Give stable IDs (IRA-01..IRA-15, DDQ-01..DDQ-26); IRA-16
  is the one question added after v1 (see below).
- IRA-16 (CONFIRMED, added after v1): "Will employee or other personal information be shared?"
  Area: Data. Yes = High, No = Low. Deloitte answer: No. It is NOT in the manual assessment: mark it
  in the data and the UI as "added after v1, not in the manual assessment". The verbatim v1 test
  covers the original 15 rows only.
- My v1 overall inherent rating is Medium. Keep it as the back-test target.
- VENDOR DISCLAIMER (verbatim, on the intake screen, in the report footer and in the README):
  "Vendor responses are illustrative and were written for this portfolio. They are not Deloitte's
  actual responses and make no statement about Deloitte's security practices."

## Sample 2 (last PR)
- Vendor: Northbridge Billing Systems (FICTIONAL). Service: cloud-hosted customer billing and
  account management platform (SaaS) for PUC's residential and commercial customers.
- Purpose: show that a higher-risk engagement gets a different tier and outcome, using the SAME
  16 IRA questions (15 from v1 + IRA-16) and 26 questionnaire questions and the SAME rules.
  No new screens or logic.
- Profile to draft: customer PII = Yes, hosts company data = Yes, cloud = Yes, business-critical
  = Yes, data stored in the US (so the FIPPA flag triggers), subcontractor = US cloud hosting
  provider; mostly mature answers with 2-3 realistic gaps (e.g. SOC 2 report has qualified
  exceptions, no Canadian data residency option, breach notification within 72 hours not
  committed). Expected: High inherent risk, Tier 1, Escalate or Approve with conditions.
- Draft data/sample2-vendor.json and show it to me for approval before wiring it in. I own the content.
- Intake screen gets a simple sample picker: "Sample 1: Deloitte (AI governance consulting)" /
  "Sample 2: Northbridge (customer billing SaaS, fictional)". Demo mode needs saved outputs for both.
- Note in the app and README that Northbridge is fictional.

- SIG content: Shared Assessments SIG is licensed material. Questions in this project are my own
  wording "based on SIG Lite"; never reproduce SIG question text from memory. Say so on a
  "Content notice" page. NIST SP 800-161 is a US government publication; attribute NIST.

## Stack and conventions
- Next.js 16 App Router, React 19, TypeScript 5.9, Tailwind CSS 4 (via @tailwindcss/postcss),
  Node's built-in test runner (node --test). Pinned starting versions: Next 16.3.6, React 19.3.0,
  Tailwind 4.3.3, TypeScript 5.9.3, unless a security fix needs newer; tell me if you change any.
  Check current docs rather than memory. Minimal dependencies, justify each; no UI kit, no PDF library.
- Deterministic logic = pure functions in lib/ (framework-free, unit-tested). UI never computes scores.
- State: validated sessionStorage with a versioned key and schema check on load; discard anything
  that fails validation. Lost when the tab closes: say so in the UI and README.
- AI route pattern: server-side only; strict JSON schema / tool use; runtime-validate every
  response; generic user-facing errors; log only status and request id, never user text.
- PDF: print layout (@media print) behind a "Download PDF" button (browser Save as PDF). 1-2 pages.
- Excel export: the assessment workbook (IRA sheet, Due Diligence sheet, Findings sheet) as .xlsx.
  Library (CONFIRMED): write-excel-file (MIT, one dependency: fflate), using its browser build so
  the workbook is generated client-side. Justify it in the PR that adds it.
- Tests: node --test. CI runs tests before deploy. Branches + PRs so I review the Vercel preview
  before anything reaches main.
- Tone: a workflow and governance prototype, not a commercial TPRM platform. The AI suggestion,
  the human decision and the calculated result must be visibly separate in the UI.

## Workflow: three screens, human in the loop
Real-world order: intake and inherent risk FIRST (it sets the tier, which sets how deep due
diligence goes), THEN the vendor questionnaire, THEN residual risk and the report.

1. INTAKE & INHERENT RISK (screen 1)
   - "Load sample vendor" fills the IRA answers AND the questionnaire responses in one click.
   - Analyst can edit any IRA answer (Yes / No / Unknown); code re-scores live.
   - Code shows: overall inherent risk, tier, questionnaire depth, reassessment cadence, and the
     rule that produced them.
   - Every "Unknown" answer automatically becomes an open follow-up item (never silently resolved).
2. DUE DILIGENCE REVIEW (screen 2)
   - AI proposes, per questionnaire response: rating (Satisfactory / Gap / Needs evidence), a
     one-line rationale, any CONFLICT with an IRA answer (e.g. IRA says subcontractors "Unknown",
     questionnaire says none expected; IRA says data leaving Canada "Unknown", questionnaire says
     residency not guaranteed), and the evidence to request.
   - AI also flags internal IRA inconsistencies (e.g. "business-critical: Yes" but "outage would
     significantly impact operations: No").
   - Analyst edits and confirms each row; overrides need a reason. Badges: AI-suggested /
     Human-edited / Confirmed. Only confirmed rows count.
   - Analyst can resolve an IRA follow-up from a questionnaire answer (with a note), which updates
     the IRA answer and re-scores.
3. FINDINGS & REPORT (screen 3)
   - Each confirmed Gap / Needs evidence / open follow-up becomes a finding: title, source row,
     owner (analyst enters, default "Vendor owner (to assign)"), due date, status.
   - Code computes residual risk, the recommendation and the next review date.
   - Executive summary from CONFIRMED data only; every section editable; Approve, then PDF / Excel.

## Deterministic rules (pure functions, one config file, shown in the UI)
AI proposes, human confirms, CODE computes. Never let a model produce a rating, tier or decision.
Rules marked CONFIRMED were decided by Bernadette (2026-11-02). Anything else is still a DRAFT:
back-test on v1, show me results, and wait for my confirmation.
- IRA answer-to-rating table (CONFIRMED). "Unknown" = Medium for every question + open follow-up.
  Yes = High, No = Low: IRA-01, 02, 03, 05, 06, 07, 08, 10, 13, 15, 16
  Yes = Medium, No = Low: IRA-04, 11, 12, 14
  Yes = Low, No = Medium: IRA-09 (alternate vendor available)
  This reproduces all 15 v1 per-question ratings.
- Inherent risk (CONFIRMED; counts only, no average):
  High if IRA-02 (customer PII) = Yes or IRA-03 (regulated info) = Yes, or 4+ Highs in total;
  Low if no Highs and 2 or fewer Mediums; otherwise Medium.
- Tier: High -> Tier 1 (full SIG + evidence, annual review); Medium -> Tier 2 (SIG Lite,
  review every 2 years); Low -> Tier 3 (basic check, review at renewal).
- Control strength from confirmed questionnaire rows: Strong = no Gaps and <= 10% Needs evidence;
  Adequate = at most 1 Gap; Weak = otherwise.
- Residual risk: Strong -> one level below inherent (min Low); Adequate -> same as inherent;
  Weak -> one level above (max High). Marked "Provisional" while any Needs evidence row is open.
- Recommendation: Approve (no open findings) / Approve with conditions (open findings, residual
  not High) / Escalate - do not approve yet (residual High or control strength Weak).
- BC privacy flag (CONFIRMED): if data may leave Canada (IRA-13 = Yes/Unknown) AND personal
  information is involved (IRA-02 or IRA-16 = Yes/Unknown) -> "FIPPA: storage outside Canada -
  check whether a supplementary assessment is required (confirm with Privacy Office)". If not
  triggered, show it as checked, not triggered. Not legal advice; say so.
- Back-test on the v1 sample: show where the rule disagrees with my v1 labels. Differences are
  for me to decide, not bugs.

## AI route rules
- Cheapest Claude model that rates reliably (start Haiku-class; test on the v1 sample first).
  Check current Anthropic docs for model IDs, tool-use syntax and pricing. Model name in one config.
- Vendor and intake text is DATA, never instructions (prompt injection). Cap input lengths and counts.
- AI may only reference existing row IDs (IRA-xx, DDQ-xx); re-validate on the server, drop unknown
  IDs and tell the analyst how many were dropped.
- Budget: small prepaid Anthropic credit, auto-reload off. Also per-IP rate limit, app-level daily
  call cap, and DEMO MODE with saved outputs for the sample vendor, switched on automatically when
  the key is missing, rate-limited or over budget.
- Label AI output "AI-generated, human-reviewed".

## Report rules
- Figures, ratings, tier, recommendation and findings table come from code. AI writes narrative
  only, grounded in confirmed data; no invented facts, vendors, controls, amounts or dates.
  Validate that any rating or count in the narrative matches computed values; flag mismatches.
- Sections, in order: Recommendation (code-written line first); Engagement & scope; Inherent risk
  & tier; Due diligence results; Findings & conditions (owner, due date); Residual risk & next
  review date; Method & limitations. 1-2 pages; warn if over.
- Footer: "Fictional organization. AI-assisted, human-reviewed." + the vendor disclaimer.

## Six governance principles (design requirements, visible in the product, same names as Crosswalk)
1. Human-Owned GRC Logic. The AI proposes and the analyst decides. The scoring rules (inherent
   risk, tier, control strength, residual risk, recommendation, FIPPA flag) are fixed and visible
   in the app.
2. Human Approval Before Authoritative Records. Questionnaire rows and findings count only once
   confirmed; unconfirmed rows show "Awaiting review". A report can be approved only after a clean
   number check (every rating and count in the narrative matches computed values) and with a
   named preparer entered by the analyst.
3. Traceability and Auditability. Each IRA answer, questionnaire row and finding keeps its change
   history and the AI's original suggestion (vendor response -> AI suggestion -> analyst edits ->
   confirmed decision -> finding). This is for the current tab only, not a durable audit trail.
4. Transparency About Uncertainty. AI output and template text are labelled; "Unknown" answers,
   conflicts and missing evidence stay visible; an override or N/A needs a reason; the report
   states what it doesn't show (e.g. no evidence files were reviewed, no on-site assessment).
5. Deterministic Over Generative Where Possible. Scores, tier, residual risk, recommendation,
   findings list, review dates, the Excel export and every number in the report come from
   deterministic logic.
6. Data Minimization by Design. No accounts, database or saved sessions. Nothing is stored on the
   server; never log user-entered text. Describe Anthropic's data handling accurately in the README
   (check current terms; do not overclaim).

## Prototype boundaries and disclaimer
Verbatim at top of README and in the app footer/About page:
"This is a workflow and governance prototype, not a commercial TPRM platform or an enterprise-ready product."
No authentication, no database, no durable persistence, no vendor portal, no integrations, no
contract management, no continuous monitoring. Enterprise note: in practice this could run in a
GRC platform such as ServiceNow VRM or OneTrust; neither is integrated here.

## Not in v1 (v2 backlog; do not build)
An OT/SCADA software vendor with NERC CIP-013-aligned supplier checks; blank
"new vendor" intake; full SIG; uploading vendor evidence files; contract clause review; ongoing
monitoring and reassessment reminders; multi-vendor dashboard.

## README (write at the end)
First person as Bernadette: opening question, what it demonstrates, where AI helps and where it
stops, workflow with screenshots (docs/screenshots), executive report, architecture, the six
principles, prototype boundaries, the vendor disclaimer, content notice, closing reflection, and a
note that it was built with Claude Code.
