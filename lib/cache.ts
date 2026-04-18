import { Redis } from "@upstash/redis";
import type { AnalysisResult, RepoMeta } from "@/types/analysis";

export const ANALYSIS_CACHE_VERSION = "v1";

type CacheClient = {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: { ex?: number }): Promise<unknown>;
  incr?(key: string): Promise<number>;
  expire?(key: string, seconds: number): Promise<unknown>;
  del?(key: string): Promise<unknown>;
};

let redis: CacheClient | null | undefined;

export function getAnalysisCacheClient(): CacheClient | null {
  if (redis !== undefined) {
    return redis;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

export function isAnalysisCacheEnabled(): boolean {
  return Boolean(getAnalysisCacheClient());
}

export function getCacheTtlSeconds(): number {
  const ttl = Number(process.env.CACHE_TTL_SECONDS);
  return Number.isFinite(ttl) && ttl > 0 ? ttl : 60 * 60 * 24 * 30;
}

export function buildAnalysisCacheKey(repo: RepoMeta): string | null {
  if (!repo.latestCommitSha || !repo.defaultBranch) {
    return null;
  }

  const parts = [
    "codeatlas",
    "analysis",
    ANALYSIS_CACHE_VERSION,
    repo.owner.toLowerCase(),
    repo.name.toLowerCase(),
    repo.defaultBranch,
    repo.latestCommitSha,
    process.env.OPENAI_MODEL_FAST || "gpt-4.1-mini",
    process.env.OPENAI_MODEL_REASONING || process.env.OPENAI_MODEL_FAST || "gpt-4.1-mini",
    process.env.LLM_MAX_FILES || "24",
    process.env.LLM_MAX_FILE_CHARS || "8000",
    process.env.LLM_MAX_TOTAL_CHARS || "90000"
  ];

  return parts.map(sanitizeCachePart).join(":");
}

export async function readCachedAnalysis(key: string): Promise<AnalysisResult | null> {
  const client = getAnalysisCacheClient();
  if (!client) {
    return null;
  }

  return client.get<AnalysisResult>(key);
}

export async function writeCachedAnalysis(key: string, analysis: AnalysisResult): Promise<void> {
  const client = getAnalysisCacheClient();
  if (!client) {
    return;
  }

  await client.set(key, analysis, { ex: getCacheTtlSeconds() });
}

function sanitizeCachePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}
