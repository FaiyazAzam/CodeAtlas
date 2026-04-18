"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ConfidenceBadge } from "./ConfidenceBadge";
import type { AnalysisResult, TreeNode } from "@/types/analysis";

export function FileExplorer({ analysis }: { analysis: AnalysisResult }) {
  const initial = analysis.files.find((file) => file.startHere) ?? analysis.files[0];
  const [selectedPath, setSelectedPath] = useState(initial?.path ?? "");
  const selected = analysis.files.find((file) => file.path === selectedPath) ?? initial;

  const folderSummary = useMemo(() => {
    if (!selected) return undefined;
    const topFolder = selected.path.includes("/") ? selected.path.split("/")[0] : ".";
    return analysis.folderSummaries.find((folder) => folder.path === topFolder);
  }, [analysis.folderSummaries, selected]);

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <aside className="max-h-[680px] overflow-auto rounded-lg border border-line bg-ink/70 p-3 scrollbar-thin">
        <div className="mb-3 px-2">
          <p className="text-sm uppercase tracking-[0.16em] text-paper/40">Repo tree</p>
          <p className="mt-1 text-sm text-paper/60">{analysis.files.length} indexed files</p>
        </div>
        <TreeList nodes={analysis.tree} selectedPath={selectedPath} onSelect={setSelectedPath} />
      </aside>

      <section className="rounded-lg border border-line bg-ink/70 p-5">
        {selected ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.16em] text-paper/40">{selected.type}</p>
                <h3 className="mt-2 break-all font-mono text-2xl font-semibold text-paper">{selected.path}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {selected.startHere && <span className="rounded-md border border-mint/50 bg-mint/10 px-2 py-1 text-xs text-mint">start here</span>}
                {selected.important && <span className="rounded-md border border-gold/50 bg-gold/10 px-2 py-1 text-xs text-gold">important</span>}
              </div>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_320px]">
              <div>
                <h4 className="text-sm font-semibold text-paper">Purpose</h4>
                <p className="mt-2 rounded-md border border-line bg-paper/[0.035] p-4 text-sm leading-6 text-paper/65">
                  {selected.summary ?? "CodeAtlas inferred this file purpose from path, name, extension, and framework conventions."}
                </p>
                {selected.llmReason && (
                  <p className="mt-3 rounded-md border border-mint/30 bg-mint/10 p-3 text-sm leading-6 text-mint/90">
                    LLM note: {selected.llmReason}
                  </p>
                )}

                <h4 className="mt-6 text-sm font-semibold text-paper">Folder context</h4>
                <p className="mt-2 rounded-md border border-line bg-paper/[0.035] p-4 text-sm leading-6 text-paper/65">
                  {folderSummary?.summary ?? "No folder summary is available for this file."}
                </p>
              </div>

              <div className="rounded-md border border-line bg-paper/[0.035] p-4">
                <h4 className="text-sm font-semibold text-paper">Signals</h4>
                <dl className="mt-4 space-y-3 text-sm">
                  <InfoRow label="Language" value={selected.language ?? "Unknown"} />
                  <InfoRow label="Extension" value={selected.extension ?? "None"} />
                  <InfoRow label="Size" value={selected.size ? `${selected.size.toLocaleString()} bytes` : "Not provided"} />
                  <InfoRow label="Confidence" value={<ConfidenceBadge confidence={selected.important || selected.startHere ? "medium" : "low"} />} />
                </dl>
              </div>
            </div>
          </>
        ) : (
          <div className="grid min-h-[460px] place-items-center text-paper/60">Select a file to inspect.</div>
        )}
      </section>
    </div>
  );
}

function TreeList({
  nodes,
  selectedPath,
  onSelect,
  depth = 0
}: {
  nodes: TreeNode[];
  selectedPath: string;
  onSelect: (path: string) => void;
  depth?: number;
}) {
  return (
    <ul className="space-y-1">
      {nodes.map((node) => (
        <li key={node.path}>
          <button
            className={`focus-ring flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
              selectedPath === node.path ? "bg-mint/15 text-mint" : "text-paper/65 hover:bg-paper/10 hover:text-paper"
            }`}
            onClick={() => node.type === "file" && onSelect(node.path)}
            style={{ paddingLeft: `${8 + depth * 14}px` }}
            type="button"
          >
            <span className="w-4 text-paper/35">{node.type === "dir" ? "▸" : "·"}</span>
            <span className="truncate font-mono">{node.name}</span>
          </button>
          {node.children && node.children.length > 0 && (
            <TreeList nodes={node.children} selectedPath={selectedPath} onSelect={onSelect} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-paper/45">{label}</dt>
      <dd className="text-right text-paper/75">{value}</dd>
    </div>
  );
}
