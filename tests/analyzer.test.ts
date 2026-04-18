import { describe, expect, it } from "vitest";
import { analyzeRepository } from "../lib/analyzer";
import { getGitHubRepoUrlError, parseGitHubUrl } from "../lib/github";
import { selectFilesForContent, type TreeScanResult } from "../lib/llmAnalysis";
import type { RepoFile, RepoMeta } from "../types/analysis";

const repo: RepoMeta = {
  owner: "demo",
  name: "sample-next-app",
  url: "https://github.com/demo/sample-next-app",
  description: "A sample app"
};

function file(path: string): RepoFile {
  const name = path.split("/").pop() ?? path;
  const extension = name.includes(".") ? name.slice(name.lastIndexOf(".")).toLowerCase() : undefined;

  return {
    path,
    name,
    type: "file",
    extension,
    language: extension === ".tsx" || extension === ".ts" ? "TypeScript" : undefined
  };
}

describe("parseGitHubUrl", () => {
  it("extracts owner and repo from public GitHub URLs", () => {
    expect(parseGitHubUrl("https://github.com/vercel/next.js")).toEqual({
      owner: "vercel",
      repo: "next.js"
    });
    expect(parseGitHubUrl("https://github.com/demo/example.git")).toEqual({
      owner: "demo",
      repo: "example"
    });
  });

  it("explains when a GitHub URL is a profile or organization instead of a repo", () => {
    expect(parseGitHubUrl("https://github.com/Trivian-Technologies")).toBeNull();
    expect(getGitHubRepoUrlError("https://github.com/Trivian-Technologies")).toBe(
      "This looks like a GitHub profile or organization link, not a repository link. Paste a repo URL like https://github.com/owner/repository."
    );
  });
});

describe("analyzeRepository", () => {
  it("detects a Next.js app and builds useful onboarding anchors", () => {
    const analysis = analyzeRepository(
      repo,
      [
        file("README.md"),
        file("package.json"),
        file("next.config.ts"),
        file("app/layout.tsx"),
        file("app/page.tsx"),
        file("app/api/health/route.ts"),
        file("components/Button.tsx"),
        file("lib/data.ts")
      ],
      "mock"
    );

    expect(analysis.stack.some((badge) => badge.label === "Next.js")).toBe(true);
    expect(analysis.graph.nodes.some((node) => node.id === "api")).toBe(true);
    expect(analysis.onboarding.topFiles.map((entry) => entry.path)).toContain("README.md");
  });
});

describe("selectFilesForContent", () => {
  it("keeps unusual LLM-identified files even when heuristic labels are generic", () => {
    const files = [
      file("README.md"),
      file("app.py"),
      file("build_vector_store.py"),
      file("demo_checklist.md"),
      file("test_healthz.py")
    ];
    const heuristic = analyzeRepository(repo, files, "github");
    const treeScan: TreeScanResult = {
      repoHypothesis: "A Python app with a vector store build step.",
      importantFiles: [
        {
          path: "build_vector_store.py",
          reason: "Likely builds embeddings or a retrieval index for the app.",
          role: "data indexing",
          confidence: "high"
        }
      ],
      importantFolders: [],
      questions: []
    };

    expect(selectFilesForContent(files, heuristic, treeScan, 3)).toContain("build_vector_store.py");
  });
});
