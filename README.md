# TPRA: AI-Assisted Third-Party Risk Assessment

> This is a workflow and governance prototype, not a commercial TPRM platform or an enterprise-ready product.

Live demo: https://tpra.vercel.app/

I'm Bernadette Chan, a GRC analyst. I built this to answer one question: **can AI speed up a third-party risk assessment without taking the decision away from the analyst?** The scenario is Pacific Utilities Corporation (PUC), a fictional BC Crown corporation, assessing a vendor.

## What it demonstrates
- A three-screen workflow: intake and inherent risk, due diligence review, findings and report.
- AI that proposes and a human who decides. Code computes every rating, tier, residual risk, recommendation, date and number.
- Methods: NIST SP 800-161 Rev. 1 informs the inherent risk assessment; the questionnaire is my own wording, based on SIG Lite.

## Where AI helps, and where it stops
- **Helps:** suggests a rating and rationale for each of 26 questionnaire responses, flags conflicts with the intake answers, and drafts the report narrative.
- **Stops:** it never produces a rating, tier or decision. The analyst edits and confirms each row; only confirmed rows count. Overrides need a reason.
- A number check compares the narrative with the computed figures. The report can be approved only when it is clean and a preparer is named.

## Workflow
1. **Intake and inherent risk:** load the sample vendor, edit any Yes / No / Unknown answer, and see the risk level, tier, review cadence and the rule that produced them. Every "Unknown" becomes an open follow-up.
2. **Due diligence review:** review AI suggestions row by row. Resolve follow-ups from a questionnaire answer.
3. **Findings and report:** each gap, evidence request and open follow-up becomes a finding with owner and due date. Approve the 1-2 page report, then download PDF (browser Save as PDF) or Excel (Inherent Risk, Due Diligence, Findings sheets).

The rules are fixed and shown on the Rules page. Screenshots will be added to `docs/screenshots`.

## Architecture
Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4. Deterministic logic is pure, unit-tested functions in `lib/` and one rules file in `config/`; the UI never computes scores. Two server routes call the Anthropic Claude API with strict schemas, validate every response and accept only existing row IDs. A per-IP limit, a daily cap and a saved **demo mode** (used automatically when the key is missing, rate-limited or over budget) keep it cheap and safe. State is validated `sessionStorage`. Tests: `node --test`; CI runs them before deploy. The Excel file is generated in the browser with `write-excel-file`.

## Six governance principles
1. **Human-Owned GRC Logic.** The AI proposes and the analyst decides. The scoring rules (inherent risk, tier, control strength, residual risk, recommendation, FIPPA flag) are fixed and visible on the Rules page.
2. **Human Approval Before Authoritative Records.** Questionnaire rows and findings count only once confirmed; unconfirmed rows show "Awaiting review". A report can be approved only after a clean number check and with a named preparer.
3. **Traceability and Auditability.** Each answer, row and finding keeps its change history and the AI's original suggestion. This is for the current tab only, not a durable audit trail.
4. **Transparency About Uncertainty.** AI output and template text are labelled. "Unknown" answers, conflicts and missing evidence stay visible, and an override needs a reason. The report states what it does not show: no evidence files were reviewed and no on-site assessment was done.
5. **Deterministic Over Generative Where Possible.** Scores, tier, residual risk, recommendation, findings, review dates, the Excel export and every number in the report come from code.
6. **Data Minimization by Design.** No accounts, database or saved sessions. Nothing is stored on the server and user-entered text is never logged.

## Data handling
No accounts, database or saved sessions: your work lives in the browser tab and is lost when it closes. For AI steps, the vendor responses and your entries are sent through this app's server to the Anthropic API. This app stores nothing and logs only status and request id. How Anthropic handles API data is set by its current terms and privacy policy; check them, and do not enter real or sensitive information. Saved demo mode makes no AI call.

## Prototype boundaries
No authentication, database, durable persistence, vendor portal, integrations, contract management or continuous monitoring. In practice this could run in a GRC platform such as ServiceNow VRM or OneTrust; neither is integrated.

## Sample vendor
Halden Advisory (fictional), AI governance consulting. The sample is based on my manual v1 assessment in `/v1`, which used a real firm as its example. The files in `/v1` are kept exactly as I wrote them, and a test checks the extracted data against them; the app shows the fictional name instead.

> Halden Advisory is a fictional vendor. Vendor responses are illustrative and were written for this portfolio. They make no statement about any real organization's security practices.

## Content notice
The SIG is licensed material; the questions here are my own wording "based on SIG Lite" and do not reproduce SIG text. NIST SP 800-161 Rev. 1 is a U.S. government publication of NIST. The FIPPA flag is not legal advice.

## Not in v1 (backlog)
A second, higher-risk sample vendor (Northbridge Billing Systems, fictional) to show a different tier and outcome; an OT/SCADA vendor with NERC CIP-013-aligned checks; blank new-vendor intake; full SIG; evidence file upload; contract clause review; monitoring and reassessment reminders; multi-vendor dashboard.

## Reflection
The most useful design choice was the split: AI for reading and drafting, code for anything that must be defensible. It made the tool easier to trust and easier to test, and it kept the judgment calls with the analyst.

## Built with
Built with Claude Code, powered by Claude.
