import type {
  AnalysisResult,
  Confidence,
  FolderSummary,
  GraphEdge,
  GraphNode,
  Insight,
  RepoFile,
  RepoMeta,
  StackBadge,
  TreeNode
} from "@/types/analysis";

const MODULE_PATTERNS: Array<{
  id: string;
  label: string;
  kind: GraphNode["kind"];
  patterns: RegExp[];
  summary: string;
  x: number;
  y: number;
}> = [
  {
    id: "entry",
    label: "Entry Points",
    kind: "entry",
    patterns: [/^app\/(page|layout)\.tsx?$/, /^pages\/(_app|index)\.tsx?$/, /^src\/(main|index|App)\.tsx?$/, /^server\./],
    summary: "Files that likely boot the app, define shell layout, or start the runtime.",
    x: 42,
    y: 28
  },
  {
    id: "routing",
    label: "Routing Layer",
    kind: "service",
    patterns: [/^app\//, /^pages\//, /routes?\//, /router/],
    summary: "Route definitions and navigation boundaries that shape the user-facing surface.",
    x: 58,
    y: 16
  },
  {
    id: "ui",
    label: "UI Components",
    kind: "ui",
    patterns: [/components?\//, /ui\//, /\.tsx$/, /\.jsx$/],
    summary: "Reusable interface components and screens used by routes.",
    x: 80,
    y: 28
  },
  {
    id: "api",
    label: "API Layer",
    kind: "api",
    patterns: [/api\//, /controllers?\//, /handlers?\//, /server\//],
    summary: "Request handlers, backend endpoints, and server-side integration code.",
    x: 56,
    y: 52
  },
  {
    id: "data",
    label: "Data Layer",
    kind: "data",
    patterns: [/db\//, /data\//, /models?\//, /schema/, /prisma/, /migrations?\//],
    summary: "Database models, schemas, seed data, migrations, and persistence code.",
    x: 80,
    y: 60
  },
  {
    id: "shared",
    label: "Shared Utilities",
    kind: "utility",
    patterns: [/lib\//, /utils?\//, /helpers?\//, /shared\//, /hooks?\//],
    summary: "Shared helpers, hooks, services, and cross-cutting logic.",
    x: 92,
    y: 42
  },
  {
    id: "config",
    label: "Config & Tooling",
    kind: "config",
    patterns: [/config/, /package\.json$/, /tsconfig/, /eslint/, /tailwind/, /vite/, /next\.config/, /docker/i],
    summary: "Build, environment, linting, framework, and operational configuration.",
    x: 42,
    y: 78
  },
  {
    id: "tests",
    label: "Tests",
    kind: "test",
    patterns: [/__tests__/, /\.test\./, /\.spec\./, /tests?\//],
    summary: "Automated tests and validation assets that describe expected behavior.",
    x: 78,
    y: 84
  }
];

export function analyzeRepository(repo: RepoMeta, files: RepoFile[], source: AnalysisResult["source"]): AnalysisResult {
  // Future enrichment can read selected source files, parse imports, and layer LLM summaries on top of these heuristics.
  const enrichedFiles = files.map((file) => ({
    ...file,
    summary: summarizeFile(file),
    important: file.important || isImportant(file.path),
    startHere: file.startHere || isStartHere(file.path)
  }));

  const stack = detectStack(enrichedFiles);
  const folderSummaries = summarizeFolders(enrichedFiles);
  const graph = buildGraph(enrichedFiles);
  const insights = buildInsights(enrichedFiles, stack, graph.nodes);
  const onboarding = buildOnboarding(repo, enrichedFiles, folderSummaries, graph.nodes);

  return {
    repo,
    generatedAt: new Date().toISOString(),
    source,
    tree: buildTree(enrichedFiles),
    files: enrichedFiles,
    stack,
    insights,
    folderSummaries,
    graph,
    onboarding
  };
}

export function buildTree(files: RepoFile[]): TreeNode[] {
  const root: TreeNode[] = [];
  const directories = new Map<string, TreeNode[]>();
  directories.set("", root);

  [...files].sort((a, b) => a.path.localeCompare(b.path)).forEach((file) => {
    const parts = file.path.split("/");
    let currentPath = "";
    let siblings = root;

    parts.forEach((part, index) => {
      const isLeaf = index === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let node = siblings.find((candidate) => candidate.name === part);

      if (!node) {
        node = {
          name: part,
          path: currentPath,
          type: isLeaf ? file.type : "dir",
          children: isLeaf && file.type === "file" ? undefined : [],
          file: isLeaf ? file : undefined
        };
        siblings.push(node);
      }

      if (!isLeaf) {
        if (!node.children) {
          node.children = [];
        }
        directories.set(currentPath, node.children);
        siblings = node.children;
      }
    });
  });

  return sortTree(root);
}

function sortTree(nodes: TreeNode[]): TreeNode[] {
  return nodes
    .sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "dir" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    })
    .map((node) => ({
      ...node,
      children: node.children ? sortTree(node.children) : undefined
    }));
}

function detectStack(files: RepoFile[]): StackBadge[] {
  const paths = new Set(files.map((file) => file.path));
  const badges: StackBadge[] = [];
  const add = (label: string, kind: StackBadge["kind"], confidence: Confidence = "medium") => {
    if (!badges.some((badge) => badge.label === label)) {
      badges.push({ label, kind, confidence });
    }
  };

  if (files.some((file) => file.extension === ".ts" || file.extension === ".tsx")) add("TypeScript", "language", "high");
  if (files.some((file) => file.extension === ".js" || file.extension === ".jsx")) add("JavaScript", "language", "high");
  if (paths.has("next.config.ts") || paths.has("next.config.js") || files.some((file) => file.path.startsWith("app/"))) {
    add("Next.js", "framework", "high");
  }
  if (paths.has("vite.config.ts") || paths.has("vite.config.js")) add("Vite", "tool", "high");
  if (paths.has("tailwind.config.ts") || paths.has("tailwind.config.js")) add("Tailwind CSS", "framework", "high");
  if (files.some((file) => file.path.includes("prisma/") || file.name === "schema.prisma")) add("Prisma", "database", "medium");
  if (files.some((file) => file.path.includes("supabase"))) add("Supabase", "database", "medium");
  if (files.some((file) => file.name.includes("playwright"))) add("Playwright", "test", "medium");
  if (files.some((file) => file.name.includes("vitest"))) add("Vitest", "test", "medium");
  if (paths.has("requirements.txt") || paths.has("pyproject.toml")) add("Python", "language", "high");
  if (paths.has("go.mod")) add("Go", "language", "high");
  if (paths.has("Cargo.toml")) add("Rust", "language", "high");

  return badges.length ? badges : [{ label: "Stack unclear", kind: "tool", confidence: "low" }];
}

function summarizeFolders(files: RepoFile[]): FolderSummary[] {
  const folderMap = new Map<string, RepoFile[]>();

  files.forEach((file) => {
    const folder = file.path.includes("/") ? file.path.split("/").slice(0, -1).join("/") : ".";
    const topFolder = folder === "." ? "." : folder.split("/")[0];
    folderMap.set(topFolder, [...(folderMap.get(topFolder) ?? []), file]);
  });

  return Array.from(folderMap.entries())
    .map(([path, folderFiles]) => ({
      path,
      summary: summarizeFolder(path, folderFiles),
      confidence: (folderFiles.length > 3 ? "medium" : "low") as Confidence,
      keyFiles: folderFiles.filter((file) => file.important || file.startHere).slice(0, 5).map((file) => file.path)
    }))
    .sort((a, b) => {
      if (a.path === ".") return -1;
      if (b.path === ".") return 1;
      return a.path.localeCompare(b.path);
    });
}

function buildGraph(files: RepoFile[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes = MODULE_PATTERNS.map((module) => {
    const matches = files.filter((file) => module.patterns.some((pattern) => pattern.test(file.path)));
    if (!matches.length && module.id !== "entry") {
      return null;
    }

    return {
      id: module.id,
      label: module.label,
      kind: module.kind,
      summary: module.summary,
      keyFiles: matches.filter((file) => file.important || file.startHere).slice(0, 6).map((file) => file.path),
      confidence: matches.length >= 3 ? "high" : matches.length > 0 ? "medium" : "low",
      x: module.x,
      y: module.y
    } satisfies GraphNode;
  }).filter((node): node is GraphNode => Boolean(node));

  const nodeIds = new Set(nodes.map((node) => node.id));
  const proposedEdges: GraphEdge[] = [
    { id: "entry-routing", source: "entry", target: "routing", label: "boots routes", confidence: "medium" },
    { id: "routing-ui", source: "routing", target: "ui", label: "renders views", confidence: "medium" },
    { id: "routing-api", source: "routing", target: "api", label: "calls endpoints", confidence: "low" },
    { id: "api-data", source: "api", target: "data", label: "reads and writes", confidence: "medium" },
    { id: "ui-shared", source: "ui", target: "shared", label: "uses helpers", confidence: "medium" },
    { id: "api-shared", source: "api", target: "shared", label: "uses services", confidence: "medium" },
    { id: "config-entry", source: "config", target: "entry", label: "configures runtime", confidence: "high" },
    { id: "tests-shared", source: "tests", target: "shared", label: "validates behavior", confidence: "low" }
  ];

  return {
    nodes,
    edges: proposedEdges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
  };
}

function buildInsights(files: RepoFile[], stack: StackBadge[], nodes: GraphNode[]): Insight[] {
  const entryFiles = files.filter((file) => file.startHere).slice(0, 4);
  const insightStack = stack.slice(0, 4).map((badge) => badge.label).join(", ");
  const majorModules = nodes.map((node) => node.label).join(", ");

  return [
    {
      title: "Likely stack",
      detail: insightStack ? `Detected ${insightStack} from conventional config and file extensions.` : "The stack needs deeper inspection.",
      confidence: stack.some((badge) => badge.confidence === "high") ? "high" : "low"
    },
    {
      title: "Main reading path",
      detail: entryFiles.length
        ? `Start with ${entryFiles.map((file) => file.path).join(", ")} before diving into feature folders.`
        : "Start with README and the top-level package or framework config files.",
      confidence: entryFiles.length ? "medium" : "low"
    },
    {
      title: "Architecture shape",
      detail: majorModules ? `The repo appears organized around ${majorModules}.` : "The repo does not expose enough common folders to infer modules confidently.",
      confidence: nodes.length >= 4 ? "medium" : "low"
    }
  ];
}

function buildOnboarding(repo: RepoMeta, files: RepoFile[], folders: FolderSummary[], nodes: GraphNode[]) {
  const topFiles = pickTopFiles(files);
  const entry = nodes.find((node) => node.id === "entry");
  const hasApi = nodes.some((node) => node.id === "api");
  const hasData = nodes.some((node) => node.id === "data");

  return {
    whatItDoes:
      repo.description ??
      `${repo.name} is a public GitHub repository. CodeAtlas inferred its purpose from structure, config, and naming conventions.`,
    structure: folders
      .slice(0, 5)
      .map((folder) => `${folder.path}: ${folder.summary}`)
      .join(" "),
    topFiles,
    probableFlow: [
      entry?.keyFiles.length
        ? `Runtime starts near ${entry.keyFiles[0]}, then hands off to routes or application shell code.`
        : "Runtime likely starts from a framework convention or top-level package entry.",
      hasApi ? "Route or UI code likely calls API handlers for server-side work." : "Server/API boundaries are not obvious from the file tree.",
      hasData ? "API or service code likely uses model/schema files for persistence." : "A dedicated persistence layer was not detected with high confidence.",
      "Shared helpers and configuration support the main runtime path."
    ],
    questions: [
      "Which folders are generated versus handwritten?",
      "Where are environment variables documented?",
      "Which tests cover the highest-risk paths?",
      "Are API boundaries enforced by framework conventions or internal services?"
    ]
  };
}

function pickTopFiles(files: RepoFile[]) {
  const preferred = [
    "README.md",
    "package.json",
    "app/page.tsx",
    "app/layout.tsx",
    "src/main.tsx",
    "src/App.tsx",
    "pages/_app.tsx",
    "next.config.ts",
    "next.config.js",
    "schema.prisma"
  ];

  return files
    .filter((file) => preferred.some((path) => file.path.endsWith(path)) || file.startHere || file.important)
    .slice(0, 5)
    .map((file) => ({
      path: file.path,
      reason: summarizeFile(file),
      confidence: file.startHere ? ("high" as const) : ("medium" as const)
    }));
}

function summarizeFolder(path: string, files: RepoFile[]): string {
  if (path === ".") return "Top-level project files that define setup, documentation, and tooling.";
  if (/^(app|pages)$/.test(path)) return "Framework routes, layouts, and screens that define the application surface.";
  if (/^components?$/.test(path)) return "Reusable UI building blocks shared across routes and features.";
  if (/^(lib|utils?|shared)$/.test(path)) return "Shared helpers, service wrappers, and cross-cutting application logic.";
  if (/^(api|server)$/.test(path)) return "Server-side request handling and integration boundaries.";
  if (/^(data|db|models?|prisma)$/.test(path)) return "Persistence, schema, and model definitions.";
  if (/^(public|assets)$/.test(path)) return "Static assets served by the app.";
  if (/^(test|tests|__tests__)$/.test(path)) return "Automated tests and fixtures.";

  const languages = new Set(files.map((file) => file.language).filter(Boolean));
  return `Contains ${files.length} tracked item${files.length === 1 ? "" : "s"}${languages.size ? `, mostly ${Array.from(languages).slice(0, 3).join(", ")}` : ""}.`;
}

function summarizeFile(file: RepoFile): string {
  const path = file.path;
  const name = file.name;

  if (name === "README.md") return "Project overview, setup notes, and first source of intent.";
  if (name === "package.json") return "JavaScript package manifest with scripts, dependencies, and runtime clues.";
  if (name.startsWith("next.config")) return "Next.js runtime and build configuration.";
  if (name.startsWith("tailwind.config")) return "Tailwind CSS design system and content scanning configuration.";
  if (name === "tsconfig.json") return "TypeScript compiler settings and path aliases.";
  if (name === "schema.prisma") return "Prisma database schema and generated client source of truth.";
  if (/app\/layout\.tsx?$/.test(path)) return "Application shell layout and shared metadata for routes.";
  if (/app\/page\.tsx?$/.test(path)) return "Primary route component for the app home page.";
  if (/route\.tsx?$/.test(path)) return "API or route handler that responds to requests.";
  if (/\.test\.|\.spec\./.test(path)) return "Automated test file that documents expected behavior.";
  if (/components?\//.test(path)) return "Reusable UI component used by screens or feature modules.";
  if (/lib\//.test(path)) return "Shared logic or integration helper used across the codebase.";

  return `${file.language ?? "Source"} file inferred from its location and naming.`;
}

function isImportant(path: string): boolean {
  return /(^|\/)(README\.md|package\.json|next\.config\.(js|ts)|vite\.config\.(js|ts)|tailwind\.config\.(js|ts)|tsconfig\.json|schema\.prisma|docker-compose\.ya?ml|route\.ts|layout\.tsx|page\.tsx)$/i.test(
    path
  );
}

function isStartHere(path: string): boolean {
  return /(^|\/)(README\.md|package\.json|app\/page\.tsx|app\/layout\.tsx|src\/main\.tsx|src\/App\.tsx|pages\/_app\.tsx)$/i.test(
    path
  );
}
