import OpenAI from "openai";
import type {
  AnalysisResult,
  Confidence,
  FolderSummary,
  GraphNode,
  Insight,
  RepoFile,
  RepoMeta,
  StackBadge
} from "@/types/analysis";
import { fetchRepositoryFileContents, type RepoFileContent } from "./github";
import { getTimeoutConfig, withTimeout } from "./timeouts";

export type TreePick = {
  path: string;
  reason: string;
  role: string;
  confidence: Confidence;
};

export type TreeScanResult = {
  repoHypothesis: string;
  importantFiles: TreePick[];
  importantFolders: TreePick[];
  questions: string[];
};

type FileSummary = {
  path: string;
  purpose: string;
  role: string;
  confidence: Confidence;
};

type ModuleSummary = {
  label: string;
  kind: GraphNode["kind"];
  summary: string;
  keyFiles: string[];
  confidence: Confidence;
};

type LlmSynthesis = {
  repoOverview: string;
  structure: string;
  fileSummaries: FileSummary[];
  folderSummaries: FolderSummary[];
  modules: ModuleSummary[];
  insights: Insight[];
  topFiles: { path: string; reason: string; confidence: Confidence }[];
  probableFlow: string[];
  questions: string[];
};

const confidenceSchema = {
  type: "string",
  enum: ["high", "medium", "low"]
};

const treeScanSchema = {
  type: "object",
  additionalProperties: false,
  required: ["repoHypothesis", "importantFiles", "importantFolders", "questions"],
  properties: {
    repoHypothesis: { type: "string" },
    importantFiles: {
      type: "array",
      maxItems: 40,
      items: treePickSchema()
    },
    importantFolders: {
      type: "array",
      maxItems: 20,
      items: treePickSchema()
    },
    questions: {
      type: "array",
      maxItems: 8,
      items: { type: "string" }
    }
  }
};

const synthesisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["repoOverview", "structure", "fileSummaries", "folderSummaries", "modules", "insights", "topFiles", "probableFlow", "questions"],
  properties: {
    repoOverview: { type: "string" },
    structure: { type: "string" },
    fileSummaries: {
      type: "array",
      maxItems: 40,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "purpose", "role", "confidence"],
        properties: {
          path: { type: "string" },
          purpose: { type: "string" },
          role: { type: "string" },
          confidence: confidenceSchema
        }
      }
    },
    folderSummaries: {
      type: "array",
      maxItems: 30,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "summary", "confidence", "keyFiles"],
        properties: {
          path: { type: "string" },
          summary: { type: "string" },
          confidence: confidenceSchema,
          keyFiles: {
            type: "array",
            maxItems: 8,
            items: { type: "string" }
          }
        }
      }
    },
    modules: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "kind", "summary", "keyFiles", "confidence"],
        properties: {
          label: { type: "string" },
          kind: {
            type: "string",
            enum: ["entry", "ui", "api", "data", "config", "utility", "service", "test"]
          },
          summary: { type: "string" },
          keyFiles: {
            type: "array",
            maxItems: 8,
            items: { type: "string" }
          },
          confidence: confidenceSchema
        }
      }
    },
    insights: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "confidence"],
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          confidence: confidenceSchema
        }
      }
    },
    topFiles: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "reason", "confidence"],
        properties: {
          path: { type: "string" },
          reason: { type: "string" },
          confidence: confidenceSchema
        }
      }
    },
    probableFlow: {
      type: "array",
      maxItems: 8,
      items: { type: "string" }
    },
    questions: {
      type: "array",
      maxItems: 10,
      items: { type: "string" }
    }
  }
};

export function hasLlmConfig(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function enhanceAnalysisWithLLM(repo: RepoMeta, files: RepoFile[], heuristic: AnalysisResult): Promise<AnalysisResult> {
  if (!hasLlmConfig()) {
    return heuristic;
  }

  const fastModel = process.env.OPENAI_MODEL_FAST || "gpt-4.1-mini";
  const reasoningModel = process.env.OPENAI_MODEL_REASONING || fastModel;
  const maxFiles = readNumberEnv("LLM_MAX_FILES", 24);
  const maxFileChars = readNumberEnv("LLM_MAX_FILE_CHARS", 8000);
  const maxTotalChars = readNumberEnv("LLM_MAX_TOTAL_CHARS", 90000);

  const treeScan = await withTimeout(
    scanTreeWithLLM(repo, files, heuristic.stack, fastModel),
    getTimeoutConfig().llmMs,
    "LLM tree scan timed out."
  );
  const selectedPaths = selectFilesForContent(files, heuristic, treeScan, maxFiles);
  const contents = await fetchRepositoryFileContents(repo, selectedPaths, {
    maxFileChars,
    maxTotalChars
  });

  if (!contents.length) {
    return {
      ...heuristic,
      warnings: [...(heuristic.warnings ?? []), "LLM was configured, but no selected file contents could be fetched."]
    };
  }

  const synthesis = await withTimeout(
    synthesizeWithLLM(repo, files, heuristic, treeScan, contents, reasoningModel),
    getTimeoutConfig().llmMs,
    "LLM repository synthesis timed out."
  );
  return mergeLlmSynthesis(heuristic, synthesis, treeScan, contents);
}

async function scanTreeWithLLM(repo: RepoMeta, files: RepoFile[], stack: StackBadge[], model: string): Promise<TreeScanResult> {
  const treeLines = files
    .slice(0, 1200)
    .map((file) => `${file.type === "dir" ? "dir " : "file"} ${file.path}${file.size ? ` (${file.size} bytes)` : ""}`)
    .join("\n");

  const input = `Repository: ${repo.owner}/${repo.name}
Description: ${repo.description ?? "Not provided"}
Detected stack: ${stack.map((badge) => `${badge.label} (${badge.confidence})`).join(", ")}

Filtered file tree:
${treeLines}

Task:
Review the full tree before file contents are fetched. Pick files and folders that are likely important even if they use unusual names. Include entry points, build scripts, data/vector/indexing files, API handlers, model/data files, orchestration files, tests, configs, and documentation.`;

  return requestStructured<TreeScanResult>({
    model,
    name: "codeatlas_tree_scan",
    schema: treeScanSchema,
    instructions:
      "You are CodeAtlas. Infer likely repo architecture from a file tree. Be concise. Prefer concrete paths. Do not invent paths that are not in the tree.",
    input,
    maxOutputTokens: 4500
  });
}

async function synthesizeWithLLM(
  repo: RepoMeta,
  files: RepoFile[],
  heuristic: AnalysisResult,
  treeScan: TreeScanResult,
  contents: RepoFileContent[],
  model: string
): Promise<LlmSynthesis> {
  const compactTree = files
    .slice(0, 900)
    .map((file) => `${file.type === "dir" ? "dir " : "file"} ${file.path}`)
    .join("\n");
  const contentBlocks = contents
    .map(
      (file) => `--- FILE: ${file.path}${file.truncated ? " (truncated)" : ""}
${file.content}`
    )
    .join("\n\n");

  const input = `Repository: ${repo.owner}/${repo.name}
Description: ${repo.description ?? "Not provided"}

Current heuristic overview:
${heuristic.onboarding.whatItDoes}

LLM tree-only picks:
${treeScan.importantFiles.map((file) => `- ${file.path}: ${file.reason}`).join("\n")}

Filtered file tree:
${compactTree}

Selected file contents:
${contentBlocks}

Task:
Use the tree and selected contents to produce a practical architecture overview for a developer joining the repo. Improve generic file/folder summaries. Clearly mark uncertainty. Do not claim you saw files that are not present.`;

  return requestStructured<LlmSynthesis>({
    model,
    name: "codeatlas_repo_synthesis",
    schema: synthesisSchema,
    instructions:
      "You are CodeAtlas. Explain unfamiliar repositories in plain English for developers. Return structured, concise, grounded analysis only.",
    input,
    maxOutputTokens: 7000
  });
}

async function requestStructured<T>({
  model,
  name,
  schema,
  instructions,
  input,
  maxOutputTokens
}: {
  model: string;
  name: string;
  schema: object;
  instructions: string;
  input: string;
  maxOutputTokens: number;
}): Promise<T> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model,
    instructions,
    input,
    max_output_tokens: maxOutputTokens,
    text: {
      format: {
        type: "json_schema",
        name,
        strict: true,
        schema: schema as Record<string, unknown>
      }
    }
  });

  return JSON.parse(response.output_text) as T;
}

export function selectFilesForContent(files: RepoFile[], heuristic: AnalysisResult, treeScan: TreeScanResult, maxFiles: number): string[] {
  const treePicks = new Map(treeScan.importantFiles.map((pick, index) => [pick.path, { ...pick, index }]));
  const heuristicTop = new Set([
    ...heuristic.onboarding.topFiles.map((file) => file.path),
    ...heuristic.graph.nodes.flatMap((node) => node.keyFiles)
  ]);

  return files
    .filter((file) => file.type === "file")
    .map((file) => ({
      file,
      score: scoreFile(file, treePicks, heuristicTop)
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.file.path.localeCompare(b.file.path))
    .slice(0, maxFiles)
    .map((entry) => entry.file.path);
}

function scoreFile(file: RepoFile, treePicks: Map<string, TreePick & { index: number }>, heuristicTop: Set<string>): number {
  let score = 0;
  const path = file.path.toLowerCase();
  const name = file.name.toLowerCase();
  const treePick = treePicks.get(file.path);

  if (treePick) score += 90 - Math.min(treePick.index, 20);
  if (heuristicTop.has(file.path)) score += 45;
  if (file.startHere) score += 35;
  if (file.important) score += 25;
  if (/readme|package\.json|requirements\.txt|pyproject\.toml|go\.mod|cargo\.toml/.test(name)) score += 30;
  if (/main|index|app|server|route|controller|handler|service|model|schema|db|client|config/.test(name)) score += 20;
  if (/run|build|ingest|embed|vector|agent|eval|pipeline|workflow|orchestrator|loader|worker|queue/.test(name)) score += 28;
  if (/api|server|lib|src|app|pages|components|models|data|db|prisma|services|routes/.test(path)) score += 12;
  if (/\.test\.|\.spec\.|tests?\//.test(path)) score += 8;
  if (file.size && file.size > 120_000) score -= 18;

  return score;
}

function mergeLlmSynthesis(
  heuristic: AnalysisResult,
  synthesis: LlmSynthesis,
  treeScan: TreeScanResult,
  contents: RepoFileContent[]
): AnalysisResult {
  const fileSummaries = new Map(synthesis.fileSummaries.map((file) => [file.path, file]));
  const contentPaths = new Set(contents.map((file) => file.path));
  const treePickReasons = new Map(treeScan.importantFiles.map((file) => [file.path, file.reason]));
  const files = heuristic.files.map((file) => {
    const summary = fileSummaries.get(file.path);
    if (!summary) {
      return {
        ...file,
        llmReason: treePickReasons.get(file.path)
      };
    }

    return {
      ...file,
      summary: summary.purpose,
      llmSummary: summary.purpose,
      llmReason: summary.role,
      important: file.important || contentPaths.has(file.path),
      startHere: file.startHere || synthesis.topFiles.some((topFile) => topFile.path === file.path)
    };
  });

  const graphNodes = mergeGraphNodes(heuristic.graph.nodes, synthesis.modules);

  return {
    ...heuristic,
    source: "llm",
    generatedAt: new Date().toISOString(),
    warnings: heuristic.warnings,
    files,
    insights: synthesis.insights.length ? synthesis.insights : heuristic.insights,
    folderSummaries: mergeFolderSummaries(heuristic.folderSummaries, synthesis.folderSummaries),
    graph: {
      nodes: graphNodes,
      edges: heuristic.graph.edges
    },
    onboarding: {
      whatItDoes: synthesis.repoOverview || heuristic.onboarding.whatItDoes,
      structure: synthesis.structure || heuristic.onboarding.structure,
      topFiles: synthesis.topFiles.length ? synthesis.topFiles.slice(0, 5) : heuristic.onboarding.topFiles,
      probableFlow: synthesis.probableFlow.length ? synthesis.probableFlow : heuristic.onboarding.probableFlow,
      questions: synthesis.questions.length ? synthesis.questions : heuristic.onboarding.questions
    }
  };
}

function mergeGraphNodes(existing: GraphNode[], modules: ModuleSummary[]): GraphNode[] {
  if (!modules.length) {
    return existing;
  }

  const existingPositions = new Map(existing.map((node) => [node.kind, { x: node.x, y: node.y }]));
  const fallbackPositions = [
    { x: 42, y: 28 },
    { x: 58, y: 16 },
    { x: 80, y: 28 },
    { x: 56, y: 52 },
    { x: 80, y: 60 },
    { x: 92, y: 42 },
    { x: 42, y: 78 },
    { x: 78, y: 84 }
  ];

  return modules.slice(0, 8).map((module, index) => {
    const position = existingPositions.get(module.kind) ?? fallbackPositions[index] ?? { x: 50, y: 50 };
    return {
      id: slugify(module.label || module.kind),
      label: module.label,
      kind: module.kind,
      summary: module.summary,
      keyFiles: module.keyFiles,
      confidence: module.confidence,
      x: position.x,
      y: position.y
    };
  });
}

function mergeFolderSummaries(existing: FolderSummary[], enhanced: FolderSummary[]): FolderSummary[] {
  if (!enhanced.length) {
    return existing;
  }

  const enhancedByPath = new Map(enhanced.map((folder) => [folder.path, folder]));
  const merged = existing.map((folder) => enhancedByPath.get(folder.path) ?? folder);
  enhanced.forEach((folder) => {
    if (!existing.some((existingFolder) => existingFolder.path === folder.path)) {
      merged.push(folder);
    }
  });
  return merged;
}

function treePickSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["path", "reason", "role", "confidence"],
    properties: {
      path: { type: "string" },
      reason: { type: "string" },
      role: { type: "string" },
      confidence: confidenceSchema
    }
  };
}

function readNumberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
