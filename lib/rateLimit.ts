import { getAnalysisCacheClient } from "./cache";

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfter: number;
  key: string;
};

type MemoryBucket = {
  count: number;
  resetAt: number;
};

const memoryBuckets = new Map<string, MemoryBucket>();

export function getRateLimitConfig() {
  return {
    limit: readPositiveInteger("RATE_LIMIT_MAX_REQUESTS", 15),
    windowSeconds: readPositiveInteger("RATE_LIMIT_WINDOW_SECONDS", 60 * 60),
    keyPrefix: "codeatlas:rate:v1"
  };
}

export function getLlmRateLimitConfig() {
  return {
    limit: readPositiveInteger("LLM_RATE_LIMIT_MAX_REQUESTS", 5),
    windowSeconds: readPositiveInteger("LLM_RATE_LIMIT_WINDOW_SECONDS", 60 * 60 * 24),
    keyPrefix: "codeatlas:rate:llm:v1"
  };
}

export function getClientIdentifier(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();
  return sanitizeIdentifier(forwardedFor || realIp || cloudflareIp || "local");
}

export async function checkRateLimit(identifier: string, now = Date.now()): Promise<RateLimitResult> {
  return checkBucket(identifier, getRateLimitConfig(), now);
}

export async function checkLlmRateLimit(identifier: string, now = Date.now()): Promise<RateLimitResult> {
  return checkBucket(identifier, getLlmRateLimitConfig(), now);
}

async function checkBucket(
  identifier: string,
  config: ReturnType<typeof getRateLimitConfig>,
  now: number
): Promise<RateLimitResult> {
  const { limit, windowSeconds, keyPrefix } = config;
  const bucket = Math.floor(now / (windowSeconds * 1000));
  const resetAt = (bucket + 1) * windowSeconds * 1000;
  const key = `${keyPrefix}:${identifier}:${bucket}`;
  const redis = getAnalysisCacheClient();

  if (redis?.incr && redis.expire) {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds + 30);
    }
    return toResult(key, count, limit, resetAt, now);
  }

  const existing = memoryBuckets.get(key);
  const nextCount = existing && existing.resetAt > now ? existing.count + 1 : 1;
  memoryBuckets.set(key, { count: nextCount, resetAt });
  cleanupMemoryBuckets(now);
  return toResult(key, nextCount, limit, resetAt, now);
}

export function llmRateLimitHeaders(result: RateLimitResult): HeadersInit {
  const headers: Record<string, string> = {
    "X-LLMRateLimit-Limit": String(result.limit),
    "X-LLMRateLimit-Remaining": String(result.remaining),
    "X-LLMRateLimit-Reset": String(Math.ceil(result.resetAt / 1000))
  };

  if (!result.allowed) {
    headers["X-LLMRateLimit-RetryAfter"] = String(result.retryAfter);
  }

  return headers;
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000))
  };

  if (!result.allowed) {
    headers["Retry-After"] = String(result.retryAfter);
  }

  return headers;
}

function toResult(key: string, count: number, limit: number, resetAt: number, now: number): RateLimitResult {
  const remaining = Math.max(limit - count, 0);
  return {
    allowed: count <= limit,
    limit,
    remaining,
    resetAt,
    retryAfter: Math.max(Math.ceil((resetAt - now) / 1000), 1),
    key
  };
}

function cleanupMemoryBuckets(now: number): void {
  if (memoryBuckets.size < 500) {
    return;
  }

  for (const [key, bucket] of memoryBuckets.entries()) {
    if (bucket.resetAt <= now) {
      memoryBuckets.delete(key);
    }
  }
}

function readPositiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function sanitizeIdentifier(value: string): string {
  return value.replace(/[^a-zA-Z0-9:._-]/g, "-").slice(0, 80);
}
