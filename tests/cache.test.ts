import { describe, expect, it } from "vitest";
import { buildAnalysisCacheKey } from "../lib/cache";
import type { RepoMeta } from "../types/analysis";

const baseRepo: RepoMeta = {
  owner: "demo",
  name: "repo",
  url: "https://github.com/demo/repo",
  defaultBranch: "main",
  latestCommitSha: "abc123"
};

describe("buildAnalysisCacheKey", () => {
  it("includes latest commit sha so repo updates miss stale cache entries", () => {
    const first = buildAnalysisCacheKey(baseRepo);
    const second = buildAnalysisCacheKey({
      ...baseRepo,
      latestCommitSha: "def456"
    });

    expect(first).toContain("abc123");
    expect(second).toContain("def456");
    expect(first).not.toBe(second);
  });

  it("does not cache when commit sha is unavailable", () => {
    expect(
      buildAnalysisCacheKey({
        ...baseRepo,
        latestCommitSha: undefined
      })
    ).toBeNull();
  });
});
