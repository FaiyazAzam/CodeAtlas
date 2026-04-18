import { ConfidenceBadge } from "./ConfidenceBadge";
import type { ReactNode } from "react";
import type { AnalysisResult } from "@/types/analysis";

export function OnboardingGuidePanel({ analysis }: { analysis: AnalysisResult }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
      <section className="rounded-lg border border-line bg-ink/70 p-5">
        <p className="text-sm uppercase tracking-[0.16em] text-paper/40">Onboarding guide</p>
        <h3 className="mt-2 text-2xl font-semibold text-paper">First pass for a new developer</h3>

        <div className="mt-6 space-y-5">
          <GuideSection title="What this repo does">
            <p>{analysis.onboarding.whatItDoes}</p>
          </GuideSection>

          <GuideSection title="How it is structured">
            <p>{analysis.onboarding.structure || "The structure needs more source context before it can be summarized confidently."}</p>
          </GuideSection>

          <GuideSection title="Probable request or execution flow">
            <ol className="space-y-3">
              {analysis.onboarding.probableFlow.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-mint/40 bg-mint/10 text-sm font-semibold text-mint">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </GuideSection>
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-lg border border-line bg-ink/70 p-5">
          <p className="text-sm uppercase tracking-[0.16em] text-paper/40">Top 5 files</p>
          <div className="mt-4 space-y-3">
            {analysis.onboarding.topFiles.map((file, index) => (
              <div key={file.path} className="rounded-md border border-line bg-paper/[0.035] p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-mono text-sm text-mint">
                    {index + 1}. {file.path}
                  </p>
                  <ConfidenceBadge confidence={file.confidence} />
                </div>
                <p className="mt-2 text-sm leading-6 text-paper/60">{file.reason}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-ink/70 p-5">
          <p className="text-sm uppercase tracking-[0.16em] text-paper/40">Questions</p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-paper/65">
            {analysis.onboarding.questions.map((question) => (
              <li key={question} className="rounded-md border border-line bg-paper/[0.035] p-3">
                {question}
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}

function GuideSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-line bg-paper/[0.035] p-4">
      <h4 className="text-sm font-semibold text-paper">{title}</h4>
      <div className="mt-2 text-sm leading-6 text-paper/65">{children}</div>
    </section>
  );
}
