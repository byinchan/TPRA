import type { Metadata } from "next";
import Link from "next/link";
import { FICTIONAL_VENDOR, VENDOR_DISCLAIMER } from "@/lib/sample.ts";

export const metadata: Metadata = { title: "About · TPRA" };

const PRINCIPLES: [string, string][] = [
  ["Human-Owned GRC Logic", "The AI proposes and the analyst decides. The scoring rules are fixed and visible on the Rules page."],
  ["Human Approval Before Authoritative Records", "Questionnaire rows and findings count only once confirmed. A report can be approved only after a clean number check and with a named preparer."],
  ["Traceability and Auditability", "Each answer, row and finding keeps its change history and the AI's original suggestion. This lasts for the current tab only; it is not a durable audit trail."],
  ["Transparency About Uncertainty", "AI output and template text are labelled. Unknown answers, conflicts and missing evidence stay visible, and an override needs a reason."],
  ["Deterministic Over Generative Where Possible", "Scores, tier, residual risk, recommendation, findings, review dates, the Excel export and every number in the report come from code."],
  ["Data Minimization by Design", "No accounts, database or saved sessions. Nothing is stored on the server and user-entered text is never logged."],
];

export default function AboutPage() {
  return (
    <div className="max-w-3xl space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">About TPRA</h1>
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          This is a workflow and governance prototype, not a commercial TPRM platform or an enterprise-ready product.
        </p>
        <p className="text-stone-700">
          TPRA shows how AI can speed up a third-party risk assessment while the analyst keeps the decisions. It was written by
          Bernadette Chan, GRC Analyst, as a portfolio demo for Pacific Utilities Corporation (PUC), a fictional BC Crown corporation.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Workflow</h2>
        <ol className="list-decimal space-y-1 pl-5 text-stone-700">
          <li>Intake and inherent risk: answer 16 questions; code sets the risk level, tier and review cadence.</li>
          <li>Due diligence review: the AI suggests a rating for each of 26 questionnaire responses; the analyst edits and confirms.</li>
          <li>Findings and report: code computes residual risk and the recommendation; the analyst approves, then exports PDF or Excel.</li>
        </ol>
        <p className="text-sm text-stone-600">
          Where AI helps: suggesting ratings, spotting conflicts between answers, and drafting report narrative. Where it stops: it
          never produces a rating, tier or decision.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Six governance principles</h2>
        <ul className="space-y-2">
          {PRINCIPLES.map(([name, text]) => (
            <li key={name} className="text-sm text-stone-700">
              <span className="font-medium text-stone-900">{name}.</span> {text}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Your data</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-stone-700">
          <li>Your work lives in this browser tab only. Closing the tab loses it.</li>
          <li>
            When you ask for an AI suggestion or narrative, the vendor responses and your entries for that step are sent through this
            app&apos;s server to the Anthropic API. This app stores nothing and logs only status and request id.
          </li>
          <li>
            How Anthropic handles API data is set by its own current terms and privacy policy. Check them before using this with
            anything real, and do not enter real or sensitive information. The saved demo mode makes no AI call.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Not included</h2>
        <p className="text-sm text-stone-700">
          Accounts, a database, saved sessions, a vendor portal, integrations, contract management and continuous monitoring. In
          practice this workflow could run in a GRC platform such as ServiceNow VRM or OneTrust; neither is integrated here.
        </p>
      </section>

      <section className="space-y-2 text-sm text-stone-600">
        <p>
          <span className="font-medium text-stone-900">{FICTIONAL_VENDOR}.</span> {VENDOR_DISCLAIMER}
        </p>
        <p>
          Sources and licensing: see the <Link href="/content-notice" className="underline">Content notice</Link>. Built with Claude Code,
          powered by Claude.
        </p>
      </section>
    </div>
  );
}
