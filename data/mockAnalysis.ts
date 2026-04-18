import { analyzeRepository } from "@/lib/analyzer";
import type { AnalysisResult, RepoFile, RepoMeta } from "@/types/analysis";

const DEMO_GENERATED_AT = "2026-04-16T16:00:00.000Z";

const codeAtlasRepo: RepoMeta = {
  owner: "demo",
  name: "codeatlas-sample",
  url: "https://github.com/demo/codeatlas-sample",
  defaultBranch: "main",
  description: "A developer tool that maps repository structure into architecture insights.",
  stars: 1280
};

const commerceRepo: RepoMeta = {
  owner: "vercel",
  name: "commerce",
  url: "https://github.com/vercel/commerce",
  defaultBranch: "main",
  description: "A Next.js storefront with routes, providers, components, and ecommerce integrations.",
  stars: 12000
};

function file(path: string, type: RepoFile["type"] = "file"): RepoFile {
  const name = path.split("/").pop() ?? path;
  const extension = name.includes(".") ? name.slice(name.lastIndexOf(".")).toLowerCase() : undefined;

  return {
    path,
    name,
    type,
    extension,
    language: languageFor(extension),
    important: /README|package\.json|next\.config|layout|page|route|schema|tailwind|tsconfig/.test(path),
    startHere: /README|package\.json|app\/page|app\/layout|src\/main|src\/App/.test(path)
  };
}

function languageFor(extension?: string): string | undefined {
  const map: Record<string, string> = {
    ".ts": "TypeScript",
    ".tsx": "TypeScript React",
    ".js": "JavaScript",
    ".json": "JSON",
    ".md": "Markdown",
    ".css": "CSS",
    ".prisma": "Prisma"
  };

  return extension ? map[extension] : undefined;
}

export const mockAnalyses: AnalysisResult[] = [
  withStableDemoTimestamp(
    analyzeRepository(
      codeAtlasRepo,
      [
        file("README.md"),
        file("package.json"),
        file("next.config.ts"),
        file("tailwind.config.ts"),
        file("tsconfig.json"),
        file("app/layout.tsx"),
        file("app/page.tsx"),
        file("app/api/analyze/route.ts"),
        file("components/ArchitectureGraph.tsx"),
        file("components/FileExplorer.tsx"),
        file("components/OnboardingGuide.tsx"),
        file("components/RepoInput.tsx"),
        file("lib/github.ts"),
        file("lib/analyzer.ts"),
        file("lib/exportMarkdown.ts"),
        file("types/analysis.ts"),
        file("data/mockAnalysis.ts")
      ],
      "mock"
    )
  ),
  withStableDemoTimestamp(
    analyzeRepository(
      commerceRepo,
      [
        file("README.md"),
        file("package.json"),
        file("next.config.js"),
        file("app/layout.tsx"),
        file("app/page.tsx"),
        file("app/search/page.tsx"),
        file("app/product/[handle]/page.tsx"),
        file("app/cart/page.tsx"),
        file("app/api/revalidate/route.ts"),
        file("components/cart/cart-modal.tsx"),
        file("components/product/product-card.tsx"),
        file("components/layout/navbar.tsx"),
        file("lib/shopify/index.ts"),
        file("lib/shopify/types.ts"),
        file("lib/constants.ts"),
        file("public/favicon.ico"),
        file("tailwind.config.js"),
        file("tsconfig.json")
      ],
      "mock"
    )
  )
];

export function getFallbackAnalysis(repoUrl?: string): AnalysisResult {
  const fallback = mockAnalyses[0];

  if (!repoUrl) {
    return fallback;
  }

  try {
    const url = new URL(repoUrl);
    const [owner = "demo", name = "repository"] = url.pathname.split("/").filter(Boolean);
    return {
      ...fallback,
      source: "fallback",
      repo: {
        ...fallback.repo,
        owner,
        name: name.replace(/\.git$/, ""),
        url: repoUrl
      },
      generatedAt: new Date().toISOString()
    };
  } catch {
    return fallback;
  }
}

export function findMockByUrl(repoUrl: string): AnalysisResult | undefined {
  const normalized = repoUrl.toLowerCase();
  return mockAnalyses.find((analysis) => normalized.includes(`${analysis.repo.owner}/${analysis.repo.name}`.toLowerCase()));
}

function withStableDemoTimestamp(analysis: AnalysisResult): AnalysisResult {
  return {
    ...analysis,
    generatedAt: DEMO_GENERATED_AT
  };
}
