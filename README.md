# Third-Party Risk Assessment

*An AI-assisted third-party risk assessment for GRC analysts, designed so the analyst stays in charge.*

**Where can AI take the reading and cross-checking out of vendor due diligence, and where does a person still have to decide?**

A manual vendor assessment means reading a long questionnaire, comparing every answer with what was said at intake, chasing evidence, and then turning all of it into a rating, a recommendation and a report. Most of that time goes to reading and cross-checking, while the judgment calls are few. I wanted to test whether AI could do the first part, visibly, while the rating, the decision and the audit trail stay with the analyst and with fixed rules.

**Workflow:** Vendor intake → inherent risk and tier → AI-suggested due diligence review → analyst review and confirmation → deterministic residual risk → findings → executive report

> This is a workflow and governance prototype, not a commercial TPRM platform or an enterprise-ready product.

**Live demo:** https://tpra.vercel.app/

The company (Pacific Utilities Corporation, PUC) and the vendor (Halden Advisory) are fictional. The AI suggestions in demo mode are saved from a real run, and nothing you enter is stored on a server.

<!-- ![Intake and inherent risk](docs/screenshots/01-intake.png) -->
*Screenshot to add: intake and inherent risk (docs/screenshots/01-intake.png).*

## What this demonstrates
- Three screens in the order a real assessment runs: intake and inherent risk (the tier sets how deep due diligence goes), due diligence review, findings and report.
- AI suggestions for 26 questionnaire responses, each confirmed by the analyst.
- Fixed, visible rules for inherent risk, tier, residual risk, recommendation and a BC privacy (FIPPA) flag, back-tested against my manual assessment.
- Findings with owners and due dates, and an approved report as PDF and Excel.

## Where AI helps, and where it stops
**AI suggests:** a rating (Satisfactory, Gap, Needs evidence) and one-line rationale per questionnaire response, conflicts with the intake answers, inconsistencies inside the intake answers, evidence to request, and the report narrative.

**The analyst decides:** every row is edited and confirmed by the analyst. An override needs a reason. Only confirmed rows count. The analyst also assigns owners and due dates, names the preparer and approves the report.

**Deterministic logic calculates:** inherent risk, tier, review cadence, control strength, residual risk, the recommendation, findings, review dates, and every number in the report and workbook. The AI never produces a rating, tier or decision, and unknown row IDs it cites are dropped and counted.

### A real example of the guardrails
In the sample, IRA-13 (will data leave Canada?) is "Unknown", so inherent risk is Medium, Tier 2, and an open follow-up is created. If the analyst resolves it to "Yes" from the vendor's questionnaire answer, a fourth High answer tips inherent risk to High and Tier 1. The screen shows the rule that caused the change, adequate controls then leave residual risk High, and the recommendation becomes "Escalate - do not approve yet". That means a risk owner decides whether to accept the risk; it does not mean the vendor is rejected. The AI proposed none of this; the rules did, and the change history records it.

The report has a second guardrail: before approval, a number check compares every rating and count in the narrative with the computed values. A narrative that gets a count wrong cannot be approved until it is fixed.

## How it works
**1. Intake and inherent risk.** One click loads the sample vendor. The analyst can edit any of the 16 Yes / No / Unknown answers and the code re-scores live, showing the inherent risk, tier, questionnaire depth, reassessment cadence and the rule that produced them. Every "Unknown" becomes an open follow-up.

<!-- ![Due diligence review](docs/screenshots/02-review.png) -->
*Screenshot to add: due diligence review with AI suggestions (docs/screenshots/02-review.png).*

**2. Due diligence review.** The AI suggests a rating, rationale, conflict and evidence request for each response. Rows are badged AI-suggested, Human-edited or Confirmed. The analyst can resolve an intake follow-up from a questionnaire answer, with a note, which updates the answer and re-scores.

<!-- ![Findings and report](docs/screenshots/03-findings.png) -->
*Screenshot to add: findings, residual risk and recommendation (docs/screenshots/03-findings.png).*

**3. Findings and report.** Each confirmed Gap, Needs evidence row, open follow-up and triggered FIPPA flag becomes a finding with owner, due date and status. Code computes residual risk (provisional while evidence is outstanding), the recommendation and the next review date.

## Executive reporting
The one-to-two page report leads with a code-written recommendation line, then covers scope, inherent risk and tier, due diligence results, findings and conditions, residual risk and next review date, and method and limitations. The AI writes the narrative from confirmed data only and the analyst edits every section. The report states what it does not show: no evidence files were reviewed and no on-site assessment was done.

Approval needs a clean number check, a due date on every open finding and a named preparer. After approval, **Download PDF** uses the browser's print layout (Save as PDF) and **Download Excel** produces a workbook generated in the browser with five tabs: Summary, Inherent Risk, Due Diligence, Findings and an Audit trail.

<!-- ![Executive report](docs/screenshots/04-report.png) -->
*Screenshot to add: the approved executive report (docs/screenshots/04-report.png).*

## Architecture, governance and prototype scope

### How it's built
Next.js 16 (App Router), React 19, TypeScript and Tailwind CSS 4. The deterministic logic is pure, unit-tested functions in `lib/` with one rules file in `config/`; the UI never computes scores. Two server routes call the Anthropic Claude API with strict schemas, validate every response at runtime, return generic errors and log only status and request id. Session state is validated `sessionStorage` and is lost when the tab closes. Tests run with `node --test` in CI before deploy.

### Demo mode and sample data
A per-IP limit, a daily call cap and a saved **demo mode** keep the demo cheap and safe. Demo mode switches on automatically when the API key is missing, rate-limited or over budget, and it serves the saved outputs from a real model run on the sample vendor.

The sample is based on my manual v1 assessment (`/v1`), which used a real firm as the example. Those files are kept exactly as I wrote them and a test checks the extracted data against them; the app shows the fictional vendor Halden Advisory instead. Question 16 on personal information was added after v1 and is marked that way.

> Halden Advisory is a fictional vendor. Vendor responses are illustrative and were written for this portfolio. They make no statement about any real organization's security practices.

For AI steps, the vendor responses and your entries are sent through this app's server to the Anthropic API. This app stores nothing and never logs entered text. How Anthropic handles API data is set by its current terms and privacy policy; check them, and do not enter real or sensitive information.

### Methods and content notice
- The inherent risk assessment is informed by NIST SP 800-161 Rev. 1 (Cybersecurity Supply Chain Risk Management Practices), a publication of the U.S. National Institute of Standards and Technology. NIST does not endorse this project.
- The questionnaire is based on Shared Assessments SIG Lite. The SIG is licensed material; the questions here are my own wording and do not reproduce SIG text.
- The FIPPA flag (BC privacy: storage outside Canada with personal information involved) prompts a check with the Privacy Office. It is not legal advice.

### Six governance principles
1. **Human-Owned GRC Logic.** The AI proposes and the analyst decides. The scoring rules are fixed and visible on the Rules page.
2. **Human Approval Before Authoritative Records.** Rows and findings count only once confirmed. A report can be approved only after a clean number check and with a named preparer.
3. **Traceability and Auditability.** Each answer, row and finding keeps its change history and the AI's original suggestion. This covers the current tab only; it is not a durable audit trail.
4. **Transparency About Uncertainty.** AI output and template text are labelled. Unknown answers, conflicts and missing evidence stay visible, and an override or N/A needs a reason.
5. **Deterministic Over Generative Where Possible.** Scores, tier, residual risk, recommendation, findings, review dates, the Excel export and every number in the report come from code.
6. **Data Minimization by Design.** No accounts, database or saved sessions. Nothing is stored on the server.

### Intentional prototype boundaries
No authentication, database, durable persistence, vendor portal, integrations, contract management or continuous monitoring. In practice this workflow could run in a GRC platform such as ServiceNow VRM or OneTrust; neither is integrated here.

## What I'd build next
- A blank "new vendor" intake, so the tool is not limited to a sample.
- A second, higher-risk sample (Northbridge Billing Systems, a fictional customer billing SaaS) to show a different tier and outcome under the same rules.
- An OT/SCADA software vendor with NERC CIP-013-aligned supplier checks.
- Evidence file uploads and contract clause review.

## Closing reflection
The most useful design decision was the split: AI for reading and drafting, code for anything that has to be defensible. It made the tool easier to trust and to test, and it kept the judgment calls with the analyst. The guardrails turned out to be the interesting part: a number check, a visible rule and a required reason are what let a reviewer rely on a model's suggestion.

*Built with Claude Code, powered by Claude.*
