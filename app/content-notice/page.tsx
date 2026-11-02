import type { Metadata } from "next";
import { FICTIONAL_VENDOR, VENDOR_DISCLAIMER } from "@/lib/sample.ts";

export const metadata: Metadata = { title: "Content notice · TPRA" };

export default function ContentNoticePage() {
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Content notice</h1>
      <dl className="space-y-4 text-sm text-stone-700">
        <div>
          <dt className="font-medium text-stone-900">Shared Assessments SIG</dt>
          <dd>
            The SIG is licensed material. The questionnaire in this project is written in the author&apos;s own words and is based on
            SIG Lite. It does not reproduce SIG question text and is not a SIG product or an endorsed use of it.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-stone-900">NIST SP 800-161 Rev. 1</dt>
          <dd>
            Cybersecurity Supply Chain Risk Management Practices for Systems and Organizations, published by the U.S. National Institute of
            Standards and Technology (NIST). It informs the inherent risk assessment. NIST does not endorse this project.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-stone-900">Fictional organizations</dt>
          <dd>
            Pacific Utilities Corporation and {FICTIONAL_VENDOR} are fictional. {VENDOR_DISCLAIMER} The author&apos;s manual v1 assessment
            used a real firm as its example; this app shows a fictional name instead.
          </dd>
        </div>
        <div>
          <dt className="font-medium text-stone-900">FIPPA flag</dt>
          <dd>The BC privacy flag is a prompt to check with a Privacy Office. It is not legal advice.</dd>
        </div>
        <div>
          <dt className="font-medium text-stone-900">AI and software</dt>
          <dd>
            AI output is produced by Anthropic&apos;s Claude and labelled &ldquo;AI-generated, human-reviewed&rdquo;. The Excel export uses
            write-excel-file (MIT licence).
          </dd>
        </div>
      </dl>
    </div>
  );
}
