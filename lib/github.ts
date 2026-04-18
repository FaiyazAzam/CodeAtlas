import { BINARY_EXTENSIONS, IGNORED_FILENAMES, IGNORED_SEGMENTS } from "./constants";
import { fetchWithTimeout, getTimeoutConfig } from "./timeouts";
import type { RepoFile, RepoMeta } from "@/types/analysis";

type GitHubTreeItem = {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
  url: string;
};

type GitHubRepoResponse = {
  name: string;
  owner: { login: string };
  html_url: string;
  default_branch: string;
  description: string | null;
  stargazers_count: number;
};

type GitHubTreeResponse = {
  tree: GitHubTreeItem[];
  truncated: boolean;
};

type GitHubBranchResponse = {
  commit?: {
    sha?: string;
  };
};

export class InvalidGitHubRepoUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidGitHubRepoUrlError";
  }
}

export function parseGitHubUrl(repoUrl: string): { owner: string; repo: string } | null {
  try {
    const url = new URL(repoUrl.trim());
    if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
      return null;
    }

    const [owner, repo] = url.pathname.split("/").filter(Boolean);
    if (!owner || !repo) {
      return null;
    }

    return { owner, repo: repo.replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

export function getGitHubRepoUrlError(repoUrl: string): string | null {
  try {
    const url = new URL(repoUrl.trim());
    if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
      return "Enter a valid public GitHub repository URL.";
    }

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length === 1) {
      return "This looks like a GitHub profile or organization link, not a repository link. Paste a repo URL like https://github.com/owner/repository.";
    }

    if (parts.length < 2) {
      return "A GitHub repository URL must include both the owner and repository name. Example: https://github.com/vercel/next.js.";
    }

    return null;
  } catch {
    return "Enter a valid public GitHub repository URL.";
  }
}

export async function fetchRepository(repoUrl: string): Promise<{ repo: RepoMeta; files: RepoFile[] }> {
  const timeouts = getTimeoutConfig();
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    throw new InvalidGitHubRepoUrlError(getGitHubRepoUrlError(repoUrl) ?? "Enter a valid public GitHub repository URL.");
  }

  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "CodeAtlas MVP"
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const repoResponse = await fetchWithTimeout(
    `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`,
    {
      headers,
      next: { revalidate: 300 }
    },
    timeouts.githubMs,
    "GitHub repository metadata timed out."
  );

  if (!repoResponse.ok) {
    throw new Error(`GitHub returned ${repoResponse.status}. Check that the repository is public.`);
  }

  const repoData = (await repoResponse.json()) as GitHubRepoResponse;

  const treeResponse = await fetchWithTimeout(
    `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${repoData.default_branch}?recursive=1`,
    { headers, next: { revalidate: 300 } },
    timeouts.githubMs,
    "GitHub repository tree fetch timed out."
  );

  if (!treeResponse.ok) {
    throw new Error(`Could not fetch repository tree. GitHub returned ${treeResponse.status}.`);
  }

  const treeData = (await treeResponse.json()) as GitHubTreeResponse;
  const repo: RepoMeta = {
    owner: repoData.owner.login,
    name: repoData.name,
    url: repoData.html_url,
    defaultBranch: repoData.default_branch,
    latestCommitSha: await fetchLatestCommitSha(parsed.owner, parsed.repo, repoData.default_branch, headers),
    description: repoData.description ?? undefined,
    stars: repoData.stargazers_count
  };

  const files = treeData.tree
    .map(toRepoFile)
    .filter((file): file is RepoFile => Boolean(file))
    .slice(0, 1400);

  return { repo, files };
}

async function fetchLatestCommitSha(owner: string, repo: string, branch: string, headers: HeadersInit): Promise<string | undefined> {
  try {
    const response = await fetchWithTimeout(
      `https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`,
      {
        headers,
        next: { revalidate: 120 }
      },
      getTimeoutConfig().githubMs,
      "GitHub latest commit lookup timed out."
    );

    if (!response.ok) {
      return undefined;
    }

    const branchData = (await response.json()) as GitHubBranchResponse;
    return branchData.commit?.sha;
  } catch {
    return undefined;
  }
}

export type RepoFileContent = {
  path: string;
  content: string;
  truncated: boolean;
};

export async function fetchRepositoryFileContents(
  repo: RepoMeta,
  paths: string[],
  options: { maxFileChars: number; maxTotalChars: number }
): Promise<RepoFileContent[]> {
  const timeouts = getTimeoutConfig();
  if (!repo.defaultBranch) {
    return [];
  }

  const headers: HeadersInit = {
    Accept: "application/vnd.github.raw",
    "User-Agent": "CodeAtlas MVP"
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const results: RepoFileContent[] = [];
  let totalChars = 0;

  for (const path of paths) {
    if (totalChars >= options.maxTotalChars) {
      break;
    }

    const url = `https://raw.githubusercontent.com/${repo.owner}/${repo.name}/${repo.defaultBranch}/${path}`;
    try {
      const response = await fetchWithTimeout(
        url,
        { headers, next: { revalidate: 300 } },
        timeouts.fileMs,
        `Fetching ${path} timed out.`
      );
      if (!response.ok) {
        continue;
      }

      const raw = await response.text();
      if (!looksTextual(raw)) {
        continue;
      }

      const remaining = options.maxTotalChars - totalChars;
      const limit = Math.min(options.maxFileChars, remaining);
      const content = raw.slice(0, limit);
      totalChars += content.length;
      results.push({
        path,
        content,
        truncated: raw.length > content.length
      });
    } catch {
      continue;
    }
  }

  return results;
}

function toRepoFile(item: GitHubTreeItem): RepoFile | null {
  const parts = item.path.split("/");
  const name = parts[parts.length - 1];
  const extension = getExtension(name);
  const ignored =
    parts.some((part) => IGNORED_SEGMENTS.has(part)) ||
    IGNORED_FILENAMES.has(name) ||
    Boolean(extension && BINARY_EXTENSIONS.has(extension)) ||
    Boolean(item.size && item.size > 350_000);

  if (ignored) {
    return null;
  }

  return {
    path: item.path,
    name,
    type: item.type === "tree" ? "dir" : "file",
    size: item.size,
    extension,
    language: detectLanguage(name),
    important: isImportantPath(item.path),
    startHere: isStartHerePath(item.path)
  };
}

export function getExtension(name: string): string | undefined {
  const index = name.lastIndexOf(".");
  return index > 0 ? name.slice(index).toLowerCase() : undefined;
}

export function detectLanguage(name: string): string | undefined {
  const extension = getExtension(name);
  const byExtension: Record<string, string> = {
    ".ts": "TypeScript",
    ".tsx": "TypeScript React",
    ".js": "JavaScript",
    ".jsx": "JavaScript React",
    ".py": "Python",
    ".go": "Go",
    ".rs": "Rust",
    ".rb": "Ruby",
    ".php": "PHP",
    ".java": "Java",
    ".cs": "C#",
    ".json": "JSON",
    ".md": "Markdown",
    ".yml": "YAML",
    ".yaml": "YAML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".sql": "SQL"
  };

  return extension ? byExtension[extension] : undefined;
}

function isImportantPath(path: string): boolean {
  const name = path.split("/").pop() ?? path;
  return [
    "package.json",
    "next.config.js",
    "next.config.ts",
    "vite.config.ts",
    "src/main.tsx",
    "src/App.tsx",
    "app/page.tsx",
    "app/layout.tsx",
    "pages/_app.tsx",
    "README.md",
    "docker-compose.yml",
    "schema.prisma",
    "requirements.txt",
    "pyproject.toml"
  ].some((candidate) => path.endsWith(candidate) || name === candidate);
}

function isStartHerePath(path: string): boolean {
  return /(^|\/)(README\.md|package\.json|app\/page\.tsx|app\/layout\.tsx|src\/main\.tsx|src\/App\.tsx|pages\/_app\.tsx)$/i.test(
    path
  );
}

function looksTextual(content: string): boolean {
  if (!content) {
    return false;
  }

  const sample = content.slice(0, 2000);
  const nullBytes = sample.match(/\0/g)?.length ?? 0;
  return nullBytes === 0;
}
