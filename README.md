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
Human-owned GRC logic · Human approval before authoritative records · Traceability and auditability · Transparency about uncertainty · Deterministic over generative where possible · Data minimization by design. Details are on the About page.

## Data handling
No accounts, database or saved sessions: your work lives in the browser tab and is lost when it closes. For AI steps, the vendor responses and your entries are sent through this app's server to the Anthropic API. This app stores nothing and logs only status and request id. How Anthropic handles API data is set by its current terms and privacy policy; check them, and do not enter real or sensitive information.

## Prototype boundaries
No authentication, database, durable persistence, vendor portal, integrations, contract management or continuous monitoring. In practice this could run in a GRC platform such as ServiceNow VRM or OneTrust; neither is integrated.

## Sample vendor
Halden Advisory (fictional), AI governance consulting. The sample is based on my manual v1 assessment in `/v1`, which used a real firm as its example. The files in `/v1` are kept exactly as I wrote them, and a test checks the extracted data against them; the app shows the fictional name instead.

> Halden Advisory is a fictional vendor. Vendor responses are illustrative and were written for this portfolio. They make no statement about any real organization's security practices.

## Content notice
The SIG is licensed material; the questions here are my own wording "based on SIG Lite" and do not reproduce SIG text. NIST SP 800-161 Rev. 1 is a U.S. government publication of NIST. The FIPPA flag is not legal advice. See the Content notice page in the app.

## Not in v1 (backlog)
A second, higher-risk sample vendor (Northbridge Billing Systems, fictional) to show a different tier and outcome; an OT/SCADA vendor with NERC CIP-013-aligned checks; blank new-vendor intake; full SIG; evidence file upload; contract clause review; monitoring and reassessment reminders; multi-vendor dashboard.

## Reflection
The most useful design choice was the split: AI for reading and drafting, code for anything that must be defensible. It made the tool easier to trust and easier to test, and it kept the judgment calls with the analyst.

## Built with
Built with Claude Code, powered by Claude.
