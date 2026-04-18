import { ConfidenceBadge } from "./ConfidenceBadge";
import type { AnalysisResult } from "@/types/analysis";

type OverviewPanelProps = {
  analysis: AnalysisResult;
  viewMode: "new-dev" | "system";
};

export function OverviewPanel({ analysis, viewMode }: OverviewPanelProps) {
  const importantFiles = analysis.files.filter((file) => file.important || file.startHere).slice(0, 8);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-lg border border-line bg-ink/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.16em] text-paper/40">Architecture brief</p>
            <h3 className="mt-2 text-2xl font-semibold text-paper">{analysis.repo.name}</h3>
          </div>
          <a
            className="focus-ring rounded-md border border-line px-3 py-2 text-sm text-paper/65 transition hover:text-paper"
            href={analysis.repo.url}
            rel="noreferrer"
            target="_blank"
          >
            Open GitHub
          </a>
        </div>

        <p className="mt-5 text-base leading-7 text-paper/70">{analysis.onboarding.whatItDoes}</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Metric label="Files indexed" value={analysis.files.length.toString()} />
          <Metric label="Modules" value={analysis.graph.nodes.length.toString()} />
          <Metric label="Start files" value={analysis.onboarding.topFiles.length.toString()} />
        </div>

        <div className="mt-6">
          <h4 className="text-sm font-semibold text-paper">Detected stack</h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {analysis.stack.map((badge) => (
              <span key={badge.label} className="rounded-md border border-paper/10 bg-paper/[0.04] px-3 py-2 text-sm text-paper/75">
                {badge.label}
                <span className="ml-2 text-xs text-paper/40">{badge.kind}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-ink/60 p-5">
        <p className="text-sm uppercase tracking-[0.16em] text-paper/40">
          {viewMode === "new-dev" ? "Reading path" : "System signals"}
        </p>

        <div className="mt-4 space-y-3">
          {analysis.insights.map((insight) => (
            <div key={insight.title} className="rounded-md border border-line bg-paper/[0.035] p-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-semibold text-paper">{insight.title}</h4>
                <ConfidenceBadge confidence={insight.confidence} />
              </div>
              <p className="mt-2 text-sm leading-6 text-paper/60">{insight.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-ink/60 p-5 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.16em] text-paper/40">Important files</p>
            <h3 className="mt-2 text-xl font-semibold text-paper">Start with these anchors</h3>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {importantFiles.map((file) => (
            <div key={file.path} className="rounded-md border border-line bg-paper/[0.035] p-4">
              <p className="truncate font-mono text-sm text-mint">{file.path}</p>
              <p className="mt-2 text-sm leading-6 text-paper/60">{file.summary}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-paper/[0.035] p-4">
      <p className="text-2xl font-semibold text-paper">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.15em] text-paper/40">{label}</p>
    </div>
  );
}
