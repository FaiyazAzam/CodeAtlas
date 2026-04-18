export type Confidence = "high" | "medium" | "low";

export type RepoMeta = {
  owner: string;
  name: string;
  url: string;
  defaultBranch?: string;
  latestCommitSha?: string;
  description?: string;
  stars?: number;
};

export type RepoFile = {
  path: string;
  name: string;
  type: "file" | "dir";
  size?: number;
  extension?: string;
  language?: string;
  important?: boolean;
  startHere?: boolean;
  ignored?: boolean;
  summary?: string;
  llmSummary?: string;
  llmReason?: string;
};

export type TreeNode = {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: TreeNode[];
  file?: RepoFile;
};

export type StackBadge = {
  label: string;
  kind: "language" | "framework" | "tool" | "database" | "test";
  confidence: Confidence;
};

export type Insight = {
  title: string;
  detail: string;
  confidence: Confidence;
};

export type GraphNode = {
  id: string;
  label: string;
  kind: "entry" | "ui" | "api" | "data" | "config" | "utility" | "service" | "test";
  summary: string;
  keyFiles: string[];
  confidence: Confidence;
  x: number;
  y: number;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  confidence: Confidence;
};

export type FolderSummary = {
  path: string;
  summary: string;
  confidence: Confidence;
  keyFiles: string[];
};

export type OnboardingGuide = {
  whatItDoes: string;
  structure: string;
  topFiles: { path: string; reason: string; confidence: Confidence }[];
  probableFlow: string[];
  questions: string[];
};

export type AnalysisResult = {
  repo: RepoMeta;
  generatedAt: string;
  source: "github" | "mock" | "fallback" | "llm";
  warnings?: string[];
  cache?: {
    status: "hit" | "miss" | "disabled" | "bypass";
    key?: string;
    commitSha?: string;
  };
  tree: TreeNode[];
  files: RepoFile[];
  stack: StackBadge[];
  insights: Insight[];
  folderSummaries: FolderSummary[];
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  onboarding: OnboardingGuide;
};

export type AnalyzeRequest = {
  repoUrl: string;
};
