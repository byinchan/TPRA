// The executive report as printed. Code-written lines and tables come from the facts; narrative from the
// analyst-approved sections. Used for the on-screen preview, the page-fit measurement and the PDF.
import { FIPPA } from "@/config/rules.ts";
import type { ReportFacts } from "@/lib/report/facts.ts";
import { REPORT_DOES_NOT_SHOW } from "@/lib/report/facts.ts";
import { NARRATIVE_SECTIONS, type Narrative, type SectionKey } from "@/lib/report/schema.ts";

export interface ReportDocumentProps {
  facts: ReportFacts;
  recommendationLine: string;
  narrative: Narrative;
  preparer: string;
  approval: { status: "approved" | "void" | "none"; at?: string; by?: string };
  aiSource: string;
  disclaimer: string;
}

export function ReportDocument({ facts: f, recommendationLine, narrative, preparer, approval, aiSource, disclaimer }: ReportDocumentProps) {
  const title = (k: SectionKey) => NARRATIVE_SECTIONS.find((s) => s.key === k)!.title;
  const Section = ({ k, n, children }: { k: SectionKey; n: number; children?: React.ReactNode }) => (
    <section className="break-inside-avoid-page space-y-1">
      <h2 className="text-[11pt] font-semibold text-stone-900">
        {n}. {title(k)}
      </h2>
      {children}
      <p className="whitespace-pre-line">{narrative[k]}</p>
    </section>
  );
  const code = "rounded bg-stone-100 px-1.5 py-0.5 font-medium text-stone-900 print:bg-transparent print:px-0";

  return (
    <article className="space-y-3 bg-white text-[9.5pt] leading-snug text-stone-800">
      <header className="border-b border-stone-300 pb-2">
        <p className="text-[8pt] uppercase tracking-wide text-stone-500">Pacific Utilities Corporation (fictional) · Third-party risk</p>
        <h1 className="text-[15pt] font-semibold text-stone-900">Third-Party Risk Assessment Summary</h1>
        <p>
          {f.vendor} · {f.service} · assessed {f.assessedOn}
        </p>
        <p className="text-[8.5pt]">
          Prepared by: {preparer || "(not entered)"} ·{" "}
          {approval.status === "approved" ? (
            <span className="font-semibold">Approved by {approval.by} on {approval.at?.slice(0, 10)}</span>
          ) : (
            <span className="font-semibold text-red-700">DRAFT, not approved</span>
          )}
        </p>
      </header>

      <Section k="recommendation" n={1}>
        <p className={code}>{recommendationLine}</p>
        {f.recommendation?.meaning && <p className="italic">{f.recommendation.meaning}</p>}
      </Section>
      <Section k="engagement" n={2} />
      <Section k="inherentRisk" n={3}>
        <p className={code}>
          Inherent risk {f.inherentRisk.level} · {f.inherentRisk.tier} ({f.inherentRisk.depth}, {f.inherentRisk.cadence.toLowerCase()}).{" "}
          {f.inherentRisk.rule}
        </p>
        <p className={code}>{f.fippa.triggered ? `${FIPPA.message}. ${f.fippa.explanation}` : `FIPPA flag: ${f.fippa.explanation}`} Not legal advice.</p>
      </Section>
      <Section k="dueDiligence" n={4}>
        <p className={code}>
          {f.dueDiligence.rowsConfirmed}/{f.dueDiligence.rowsTotal} responses confirmed: {f.dueDiligence.satisfactory} Satisfactory,{" "}
          {f.dueDiligence.gaps} Gap, {f.dueDiligence.needsEvidence} Needs evidence. Control strength {f.dueDiligence.controlStrength}.{" "}
          {f.dueDiligence.aiSuggestionsOverridden} AI suggestion{f.dueDiligence.aiSuggestionsOverridden === 1 ? "" : "s"} overridden by the analyst.
        </p>
      </Section>
      <Section k="findings" n={5}>
        <table className="mt-1 w-full border-collapse text-[8.5pt]">
          <thead>
            <tr className="border-b border-stone-400 text-left">
              <th className="py-0.5 pr-2 font-semibold">ID</th>
              <th className="py-0.5 pr-2 font-semibold">Finding</th>
              <th className="py-0.5 pr-2 font-semibold">Owner</th>
              <th className="py-0.5 pr-2 font-semibold">Due</th>
              <th className="py-0.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {f.findings.map((x) => (
              <tr key={x.id} className="border-b border-stone-200 align-top">
                <td className="py-0.5 pr-2 font-mono text-[7.5pt]">{x.id}</td>
                <td className="py-0.5 pr-2">{x.title}</td>
                <td className="py-0.5 pr-2">{x.unassigned ? <span className="font-semibold text-red-700">Unassigned</span> : x.owner}</td>
                <td className="py-0.5 pr-2 whitespace-nowrap">{x.dueDate ?? "—"}</td>
                <td className="py-0.5">{x.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[8pt] text-stone-600">
          {f.findingCounts.open} open, {f.findingCounts.closed} closed
          {f.findingCounts.unassignedOpen > 0 && `; ${f.findingCounts.unassignedOpen} open finding${f.findingCounts.unassignedOpen === 1 ? " has" : "s have"} no assigned owner`}.
        </p>
      </Section>
      <Section k="residual" n={6}>
        <p className={code}>
          {f.residualRisk
            ? `Residual risk ${f.residualRisk.level}${f.residualRisk.provisional ? " (provisional)" : ""}. ${f.residualRisk.rule}`
            : "Residual risk not available."}{" "}
          Next review: {f.nextReviewDate ?? "at contract renewal"}.
        </p>
      </Section>
      <section className="break-inside-avoid-page space-y-1">
        <h2 className="text-[11pt] font-semibold text-stone-900">7. {title("method")}</h2>
        <p className="whitespace-pre-line">{narrative.method}</p>
        <p className={code}>{REPORT_DOES_NOT_SHOW}</p>
      </section>

      <footer className="border-t border-stone-300 pt-2 text-[7.5pt] text-stone-600">
        <p className="font-medium">Fictional organization. AI-assisted, human-reviewed.</p>
        <p>
          Figures, ratings, the tier, the recommendation and the findings table are calculated by documented rules. The narrative was
          drafted with AI ({aiSource}) and edited and approved by the preparer.
        </p>
        <p>{disclaimer}</p>
        <p>This is a workflow and governance prototype, not a commercial TPRM platform or an enterprise-ready product.</p>
      </footer>
    </article>
  );
}
