"use client";

import { useMemo, useState } from "react";
import { ConfidenceBadge } from "./ConfidenceBadge";
import type { AnalysisResult, GraphNode } from "@/types/analysis";

type ArchitectureGraphProps = {
  analysis: AnalysisResult;
  viewMode: "new-dev" | "system";
};

const nodeTone: Record<GraphNode["kind"], { accent: string; background: string; border: string }> = {
  entry: { accent: "#49d7a0", background: "rgba(73, 215, 160, 0.1)", border: "rgba(73, 215, 160, 0.45)" },
  ui: { accent: "#f4c95d", background: "rgba(244, 201, 93, 0.1)", border: "rgba(244, 201, 93, 0.45)" },
  api: { accent: "#ff6b5f", background: "rgba(255, 107, 95, 0.1)", border: "rgba(255, 107, 95, 0.45)" },
  data: { accent: "#8bd3dd", background: "rgba(139, 211, 221, 0.1)", border: "rgba(139, 211, 221, 0.45)" },
  config: { accent: "#d2c4a3", background: "rgba(210, 196, 163, 0.1)", border: "rgba(210, 196, 163, 0.45)" },
  utility: { accent: "#c0f2d2", background: "rgba(192, 242, 210, 0.1)", border: "rgba(192, 242, 210, 0.45)" },
  service: { accent: "#f0a86a", background: "rgba(240, 168, 106, 0.1)", border: "rgba(240, 168, 106, 0.45)" },
  test: { accent: "#ff9fb2", background: "rgba(255, 159, 178, 0.1)", border: "rgba(255, 159, 178, 0.45)" }
};

export function ArchitectureGraph({ analysis, viewMode }: ArchitectureGraphProps) {
  const [selectedId, setSelectedId] = useState(analysis.graph.nodes[0]?.id ?? "");
  const selected = analysis.graph.nodes.find((node) => node.id === selectedId) ?? analysis.graph.nodes[0];

  const stages = useMemo(
    () => [
      {
        title: "Start here",
        description: "Boot files and route conventions.",
        group: "start"
      },
      {
        title: "App surface",
        description: "Screens and reusable interface pieces.",
        group: "surface"
      },
      {
        title: "Backend and data",
        description: "Server endpoints, services, models, and storage.",
        group: "backend"
      },
      {
        title: "Support layer",
        description: "Shared helpers, config, tooling, and tests.",
        group: "support"
      }
    ],
    []
  );

  const mapDescription = useMemo(() => {
    if (viewMode === "system") {
      return "Read this as a high-level system path. The boxes are inferred from framework and folder conventions.";
    }
    return "Follow the stages from left to right, then click a box to see why it matters and where to read.";
  }, [viewMode]);

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <section className="min-h-[620px] overflow-hidden rounded-lg border border-line bg-ink">
        <div className="border-b border-line p-5">
          <p className="text-sm uppercase tracking-[0.16em] text-paper/40">Architecture map</p>
          <h3 className="mt-2 text-2xl font-semibold text-paper">Repo reading map</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-paper/60">{mapDescription}</p>
        </div>

        <div className="overflow-x-auto p-5 scrollbar-thin">
          <div className="grid min-w-[860px] grid-cols-[1fr_42px_1fr_42px_1fr_42px_1fr] items-stretch">
            {stages.map((stage, index) => {
              const stageNodes = analysis.graph.nodes.filter((node) => nodeBelongsToStage(node, stage.group));

              return (
                <StageColumn
                  key={stage.title}
                  description={stage.description}
                  index={index}
                  isLast={index === stages.length - 1}
                  nodes={stageNodes}
                  selectedId={selected?.id}
                  title={stage.title}
                  onSelect={setSelectedId}
                />
              );
            })}
          </div>

          {viewMode === "system" && (
            <div className="mt-6 rounded-md border border-line bg-paper/[0.035] p-4">
              <h4 className="text-sm font-semibold text-paper">Likely relationships</h4>
              <div className="mt-3 flex flex-wrap gap-2">
                {analysis.graph.edges.map((edge) => (
                  <span key={edge.id} className="rounded-md border border-paper/10 px-2 py-1 font-mono text-xs text-paper/55">
                    {edge.source} {"->"} {edge.target}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <aside className="rounded-lg border border-line bg-ink/70 p-5">
        {selected ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.16em] text-paper/40">{selected.kind}</p>
                <h3 className="mt-2 text-2xl font-semibold text-paper">{selected.label}</h3>
              </div>
              <ConfidenceBadge confidence={selected.confidence} />
            </div>

            <p className="mt-4 text-sm leading-6 text-paper/65">{selected.summary}</p>

            <div className="mt-6">
              <h4 className="text-sm font-semibold text-paper">Why it matters</h4>
              <p className="mt-2 text-sm leading-6 text-paper/55">
                {viewMode === "system"
                  ? "This node is a likely architectural boundary. Its edges show probable dependencies, not guaranteed imports."
                  : "This is a useful starting point for building a mental model before reading implementation details."}
              </p>
            </div>

            <div className="mt-6">
              <h4 className="text-sm font-semibold text-paper">Key files</h4>
              <div className="mt-3 space-y-2">
                {selected.keyFiles.length ? (
                  selected.keyFiles.map((file) => (
                    <div key={file} className="rounded-md border border-line bg-paper/[0.035] p-3 font-mono text-xs text-mint">
                      {file}
                    </div>
                  ))
                ) : (
                  <p className="rounded-md border border-line bg-paper/[0.035] p-3 text-sm text-paper/55">
                    No high-signal files were isolated for this node.
                  </p>
                )}
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-paper/60">No graph nodes were detected.</p>
        )}
      </aside>
    </div>
  );
}

function nodeBelongsToStage(node: GraphNode, group: string): boolean {
  const label = node.label.toLowerCase();

  if (group === "start") {
    return node.id === "entry" || node.id === "routing" || node.kind === "entry" || /rout|entry|boot|start/.test(label);
  }

  if (group === "surface") {
    return node.kind === "ui" || /ui|component|screen|view|page/.test(label);
  }

  if (group === "backend") {
    return node.kind === "api" || node.kind === "data" || (node.kind === "service" && !/rout|entry|boot|start/.test(label));
  }

  return node.kind === "utility" || node.kind === "config" || node.kind === "test" || node.id === "shared" || node.id === "tests";
}

function StageColumn({
  description,
  index,
  isLast,
  nodes,
  selectedId,
  title,
  onSelect
}: {
  description: string;
  index: number;
  isLast: boolean;
  nodes: GraphNode[];
  selectedId?: string;
  title: string;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <div className="rounded-lg border border-line bg-paper/[0.035] p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-paper/15 bg-paper/10 text-sm font-semibold text-paper">
            {index + 1}
          </span>
          <div>
            <h4 className="font-semibold text-paper">{title}</h4>
            <p className="mt-1 text-sm leading-5 text-paper/55">{description}</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {nodes.length ? (
            nodes.map((node) => <MapNode key={node.id} node={node} selected={node.id === selectedId} onSelect={onSelect} />)
          ) : (
            <p className="rounded-md border border-dashed border-paper/15 p-3 text-sm leading-5 text-paper/45">No strong signal detected.</p>
          )}
        </div>
      </div>

      {!isLast && (
        <div className="flex items-center px-2">
          <div className="h-px flex-1 bg-paper/25" />
          <span className="px-2 text-paper/35">&gt;</span>
          <div className="h-px flex-1 bg-paper/25" />
        </div>
      )}
    </>
  );
}

function MapNode({ node, selected, onSelect }: { node: GraphNode; selected: boolean; onSelect: (id: string) => void }) {
  const tone = nodeTone[node.kind];

  return (
    <button
      className={`focus-ring w-full rounded-md border p-3 text-left transition hover:-translate-y-0.5 ${
        selected ? "shadow-glow" : "hover:bg-paper/[0.06]"
      }`}
      onClick={() => onSelect(node.id)}
      style={{
        background: selected ? tone.background : "rgba(245, 241, 232, 0.03)",
        borderColor: selected ? tone.accent : tone.border
      }}
      type="button"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-paper">{node.label}</span>
        <span className="rounded-md px-2 py-0.5 text-xs capitalize" style={{ background: tone.background, color: tone.accent }}>
          {node.kind}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm leading-5 text-paper/55">{node.summary}</p>
      {node.keyFiles[0] && <p className="mt-3 truncate font-mono text-xs text-mint">{node.keyFiles[0]}</p>}
    </button>
  );
}
