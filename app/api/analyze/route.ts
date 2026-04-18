import { NextResponse } from "next/server";
import { analyzeRepository } from "@/lib/analyzer";
import { buildAnalysisCacheKey, isAnalysisCacheEnabled, readCachedAnalysis, writeCachedAnalysis } from "@/lib/cache";
import { fetchRepository } from "@/lib/github";
import { enhanceAnalysisWithLLM, hasLlmConfig } from "@/lib/llmAnalysis";
import { checkLlmRateLimit, checkRateLimit, getClientIdentifier, llmRateLimitHeaders, rateLimitHeaders } from "@/lib/rateLimit";
import { getTimeoutConfig, withTimeout } from "@/lib/timeouts";
import { findMockByUrl, getFallbackAnalysis } from "@/data/mockAnalysis";
import type { AnalyzeRequest } from "@/types/analysis";

export async function POST(request: Request) {
  try {
    const clientIdentifier = getClientIdentifier(request);
    const rateLimit = await checkRateLimit(clientIdentifier);
    const headers = rateLimitHeaders(rateLimit) as Record<string, string>;

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Too many analysis requests. Please wait before trying again.",
          retryAfter: rateLimit.retryAfter
        },
        { status: 429, headers }
      );
    }

    const body = (await request.json()) as Partial<AnalyzeRequest>;
    const repoUrl = body.repoUrl?.trim();

    if (!repoUrl) {
      return NextResponse.json({ error: "A GitHub repository URL is required." }, { status: 400, headers });
    }

    const mocked = findMockByUrl(repoUrl);
    if (mocked) {
      return NextResponse.json({ analysis: mocked }, { headers });
    }

    try {
      const { repo, files } = await withTimeout(
        fetchRepository(repoUrl),
        getTimeoutConfig().totalMs,
        "Repository analysis timed out before the file tree could be loaded."
      );
      const bypassCache = request.headers.get("x-codeatlas-refresh") === "true";
      const cacheKey = buildAnalysisCacheKey(repo);

      if (!bypassCache && cacheKey && isAnalysisCacheEnabled()) {
        const cached = await readCachedAnalysis(cacheKey);
        if (cached) {
          return NextResponse.json(
            {
              analysis: {
                ...cached,
                cache: {
                  status: "hit",
                  key: cacheKey,
                  commitSha: repo.latestCommitSha
                }
              }
            },
            { headers }
          );
        }
      }

      const heuristic = analyzeRepository(repo, files, "github");
      const cacheStatus = !cacheKey || !isAnalysisCacheEnabled() ? "disabled" : bypassCache ? "bypass" : "miss";
      const llmRateLimit = hasLlmConfig() ? await checkLlmRateLimit(clientIdentifier) : null;
      if (llmRateLimit) {
        Object.assign(headers, llmRateLimitHeaders(llmRateLimit));
      }

      const skippedLlmForRateLimit = Boolean(llmRateLimit && !llmRateLimit.allowed);
      const enhanced =
        llmRateLimit?.allowed
          ? await withTimeout(enhanceSafely(repo, files, heuristic), getTimeoutConfig().totalMs, "Repository analysis timed out during LLM enhancement.")
          : skippedLlmForRateLimit
            ? {
                ...heuristic,
                warnings: [
                  ...(heuristic.warnings ?? []),
                  "Daily LLM summary limit reached for this IP. Showing heuristic analysis."
                ]
              }
            : heuristic;
      const analysis = {
        ...enhanced,
        cache: {
          status: cacheStatus,
          key: cacheKey ?? undefined,
          commitSha: repo.latestCommitSha
        }
      } as const;

      if (cacheKey && isAnalysisCacheEnabled() && !skippedLlmForRateLimit) {
        await writeCachedAnalysis(cacheKey, analysis);
      }

      return NextResponse.json({ analysis }, { headers });
    } catch (error) {
      const fallback = getFallbackAnalysis(repoUrl);
      return NextResponse.json(
        {
          analysis: fallback,
          warning: error instanceof Error ? error.message : "GitHub analysis failed. Showing demo fallback."
        },
        { headers }
      );
    }
  } catch {
    return NextResponse.json({ error: "Could not analyze the repository." }, { status: 500 });
  }
}

async function enhanceSafely(
  repo: Awaited<ReturnType<typeof fetchRepository>>["repo"],
  files: Awaited<ReturnType<typeof fetchRepository>>["files"],
  heuristic: ReturnType<typeof analyzeRepository>
) {
  try {
    return await enhanceAnalysisWithLLM(repo, files, heuristic);
  } catch (error) {
    return {
      ...heuristic,
      warnings: [
        ...(heuristic.warnings ?? []),
        error instanceof Error ? `LLM enhancement failed: ${error.message}` : "LLM enhancement failed."
      ]
    };
  }
}
