"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ArchitectureGraph } from "@/components/ArchitectureGraph";
import { FileExplorer } from "@/components/FileExplorer";
import { OnboardingGuidePanel } from "@/components/OnboardingGuidePanel";
import { OverviewPanel } from "@/components/OverviewPanel";
import { RepoInput } from "@/components/RepoInput";
import { SAMPLE_REPOS } from "@/lib/constants";
import { exportAnalysisMarkdown } from "@/lib/exportMarkdown";
import { mockAnalyses } from "@/data/mockAnalysis";
import type { AnalysisResult } from "@/types/analysis";

type Tab = "overview" | "architecture" | "files" | "onboarding";
type ViewMode = "new-dev" | "system";

export default function Home() {
  const [analysis, setAnalysis] = useState<AnalysisResult>(mockAnalyses[0]);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [viewMode, setViewMode] = useState<ViewMode>("new-dev");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generatedAt = useMemo(
    () =>
      new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "UTC"
      }).format(new Date(analysis.generatedAt)),
    [analysis.generatedAt]
  );

  async function analyze(repoUrl: string, forceRefresh = false) {
    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(forceRefresh ? { "x-codeatlas-refresh": "true" } : {})
        },
        body: JSON.stringify({ repoUrl })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Analysis failed.");
      }

      setAnalysis(payload.analysis);
      const cacheStatus = payload.analysis.cache?.status;
      const cacheMessage =
        cacheStatus === "hit"
          ? "Loaded cached analysis for the latest commit."
          : cacheStatus === "bypass"
            ? "Refreshed analysis and bypassed cache."
            : cacheStatus === "miss"
              ? "Fresh analysis completed and cached."
              : `${payload.analysis.source === "llm" ? "LLM-enhanced" : "Heuristic"} analysis ready.`;
      setMessage(payload.warning ?? payload.analysis.warnings?.[0] ?? cacheMessage);
      setActiveTab("architecture");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed.");
    } finally {
      setIsLoading(false);
    }
  }

  function copyMarkdown() {
    const markdown = exportAnalysisMarkdown(analysis);
    void navigator.clipboard.writeText(markdown);
    setMessage("Markdown summary copied.");
  }

  return (
    <main className="min-h-screen px-4 py-5 text-paper sm:px-6 lg:px-8">
      <section className="mx-auto flex max-w-[1500px] flex-col gap-5">
        <header className="panel animate-floatIn overflow-hidden rounded-lg">
          <div className="grid gap-6 p-5 lg:grid-cols-[1.1fr_0.9fr] lg:p-7">
            <div className="flex flex-col justify-between gap-6">
              <div>
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <span className="rounded-md border border-mint/40 bg-mint/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-mint">
                    CodeAtlas
                  </span>
                  <span className="text-sm text-paper/60">Repo architecture in minutes</span>
                </div>
                <h1 className="max-w-4xl text-4xl font-semibold leading-tight text-paper sm:text-5xl lg:text-6xl">
                  Understand unfamiliar repositories before opening the editor.
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-paper/70">
                  Paste a public GitHub URL and get a structured architecture map, file guide, module summaries, and a first-day reading path.
                </p>
              </div>

              <RepoInput samples={SAMPLE_REPOS} isLoading={isLoading} onAnalyze={analyze} />
            </div>

            <div className="relative min-h-[270px] overflow-hidden rounded-lg border border-line bg-ink">
              <Image
                className="absolute inset-0 h-full w-full object-cover opacity-20"
                src="https://opengraph.githubassets.com/codeatlas-demo/vercel/commerce"
                alt="GitHub repository preview"
                fill
                sizes="(min-width: 1024px) 40vw, 100vw"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,16,16,0.2),rgba(16,16,16,0.96))]" />
              <div className="relative flex h-full flex-col justify-end gap-4 p-5">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["Entry points", "app/layout.tsx"],
                    ["API layer", "app/api/*"],
                    ["UI modules", "components/*"],
                    ["Data flow", "lib -> api -> ui"]
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md border border-paper/10 bg-paper/[0.06] p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-paper/45">{label}</p>
                      <p className="mt-2 truncate font-mono text-sm text-paper">{value}</p>
                    </div>
                  ))}
                </div>
                <p className="text-sm leading-6 text-paper/65">
                  Heuristic analysis keeps the first demo fast. GitHub API failures fall back to realistic sample data.
                </p>
              </div>
            </div>
          </div>
        </header>

        {(error || message) && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              error ? "border-coral/50 bg-coral/10 text-coral" : "border-mint/40 bg-mint/10 text-mint"
            }`}
          >
            {error ?? message}
          </div>
        )}

        <section className="panel rounded-lg">
          <div className="flex flex-col gap-4 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-paper">
                  {analysis.repo.owner}/{analysis.repo.name}
                </h2>
                <span className="rounded-md border border-paper/10 px-2 py-1 text-xs text-paper/60">{analysis.source}</span>
                {analysis.source === "llm" && <span className="rounded-md border border-mint/40 bg-mint/10 px-2 py-1 text-xs text-mint">LLM enhanced</span>}
                {analysis.cache?.status && (
                  <span className="rounded-md border border-paper/10 px-2 py-1 text-xs text-paper/60">cache {analysis.cache.status}</span>
                )}
                {analysis.repo.latestCommitSha && (
                  <span className="rounded-md border border-paper/10 px-2 py-1 font-mono text-xs text-paper/60">
                    {analysis.repo.latestCommitSha.slice(0, 7)}
                  </span>
                )}
                <span className="rounded-md border border-paper/10 px-2 py-1 text-xs text-paper/60">Updated {generatedAt}</span>
              </div>
              <p className="mt-1 max-w-3xl text-sm text-paper/55">{analysis.repo.description ?? analysis.repo.url}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className={`focus-ring rounded-md border px-3 py-2 text-sm transition ${
                  viewMode === "new-dev" ? "border-mint/60 bg-mint/15 text-mint" : "border-line text-paper/65 hover:text-paper"
                }`}
                onClick={() => setViewMode("new-dev")}
              >
                New Developer View
              </button>
              <button
                className={`focus-ring rounded-md border px-3 py-2 text-sm transition ${
                  viewMode === "system" ? "border-gold/70 bg-gold/15 text-gold" : "border-line text-paper/65 hover:text-paper"
                }`}
                onClick={() => setViewMode("system")}
              >
                System Design View
              </button>
              <button className="focus-ring rounded-md border border-line px-3 py-2 text-sm text-paper/70 transition hover:text-paper" onClick={copyMarkdown}>
                Export Markdown
              </button>
              <button
                className="focus-ring rounded-md border border-line px-3 py-2 text-sm text-paper/70 transition hover:text-paper"
                onClick={() => analyze(analysis.repo.url, true)}
              >
                Refresh Analysis
              </button>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto border-b border-line px-4 py-3">
            {[
              ["overview", "Overview"],
              ["architecture", "Architecture Map"],
              ["files", "File Explorer"],
              ["onboarding", "Onboarding Guide"]
            ].map(([id, label]) => (
              <button
                key={id}
                className={`focus-ring whitespace-nowrap rounded-md px-3 py-2 text-sm transition ${
                  activeTab === id ? "bg-paper text-ink" : "text-paper/60 hover:bg-paper/10 hover:text-paper"
                }`}
                onClick={() => setActiveTab(id as Tab)}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="min-h-[620px] p-4">
            {isLoading ? (
              <LoadingState />
            ) : (
              <>
                {activeTab === "overview" && <OverviewPanel analysis={analysis} viewMode={viewMode} />}
                {activeTab === "architecture" && <ArchitectureGraph analysis={analysis} viewMode={viewMode} />}
                {activeTab === "files" && <FileExplorer analysis={analysis} />}
                {activeTab === "onboarding" && <OnboardingGuidePanel analysis={analysis} />}
              </>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function LoadingState() {
  return (
    <div className="grid min-h-[560px] place-items-center rounded-lg border border-line bg-ink/60">
      <div className="w-full max-w-md p-6 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-paper/15 border-t-mint" />
        <h3 className="mt-5 text-xl font-semibold text-paper">Mapping repository</h3>
        <p className="mt-2 text-sm leading-6 text-paper/60">
          Fetching the file tree, removing noise, detecting conventions, and preparing a readable architecture map.
        </p>
      </div>
    </div>
  );
}
